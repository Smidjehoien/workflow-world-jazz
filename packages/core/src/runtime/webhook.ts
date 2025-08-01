import { waitUntil } from '@vercel/functions';
import { send } from '@vercel/queue';
import jwt from 'jsonwebtoken';
import { createWorkflowRunEvent, WorkflowAPIError } from '../backend.js';
import {
  WebhookTokenPayloadSchema,
  type WorkflowInvokePayload,
} from '../schemas.js';
import { dehydrateStepReturnValue } from '../serialization.js';

function verifyCallbackToken(token: string) {
  const secret = process.env.WORKFLOW_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      '`WORKFLOW_WEBHOOK_SECRET` environment variable is not set'
    );
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return decoded;
  } catch (err) {
    throw new Error(`Invalid callback token: ${err}`);
  }
}

/**
 * A single route that handles webhook requests by validating the JWT,
 * registering the request to the event log and retriggers the workflow.
 */
export const vercelAPIWebhooksEntrypoint = /* @__PURE__ */ async (
  req: Request
): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('No token provided', { status: 400 });
  }
  const payload = WebhookTokenPayloadSchema.parse(verifyCallbackToken(token));

  // Filter webhook requests by allowed methods as configured in the workflow
  // (by default only `POST` is allowed)
  const methods =
    typeof payload.method === 'string'
      ? [payload.method]
      : (payload.method ?? ['POST']);
  if (!methods.includes(req.method as (typeof methods)[number])) {
    const reason = `Method "${req.method}" not allowed`;
    return new Response(reason, { status: 405 });
  }

  try {
    // Create a workflow run event
    const ops: Promise<any>[] = [];
    await createWorkflowRunEvent(payload.workflowRunId, {
      event_type: 'webhook_request',
      event_data: {
        webhook_id: payload.webhookId,
        request: dehydrateStepReturnValue(req, ops, globalThis),
      },
    });
    waitUntil(Promise.all(ops));

    // Re-trigger the workflow
    const workflowInvokeMessage: WorkflowInvokePayload = {
      runId: payload.workflowRunId,
    };
    await send(`__wkf_workflow_${payload.workflowName}`, workflowInvokeMessage);

    return new Response('OK');
  } catch (err) {
    let reason = 'Internal server error';
    let status = 500;

    // More graceful error handling when a webhook has been disposed,
    // or the workflow run is no longer "running".
    if (err instanceof WorkflowAPIError && err.status === 410) {
      reason = 'Workflow webhook expired';
      status = 410;
    } else {
      console.error('Error creating workflow run event', err);
    }

    return new Response(reason, { status });
  }
};
