import { waitUntil } from '@vercel/functions';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { world } from '../adapters/index.js';
import {
  createWorkflowRunEvent,
  getWebhook,
  getWebhooksByUrl,
  getWorkflowRun,
  type Webhook,
} from '../backend.js';
import type { WorkflowInvokePayload } from '../schemas.js';
import { dehydrateStepReturnValue } from '../serialization.js';
import { getSpanContextForTraceCarrier, trace } from '../telemetry.js';

const ajv = new Ajv2020({ strict: false });

async function* webhooksIterator(
  deploymentId: string,
  request: Request
): AsyncGenerator<Webhook> {
  const url = new URL(request.url);
  const webhookId = url.searchParams.get('webhookId');
  if (webhookId) {
    const webhook = await getWebhook(webhookId, deploymentId);
    yield webhook;
  } else {
    // TODO: Handle pagination
    const webhooksResponse = await getWebhooksByUrl(url.pathname, deploymentId);
    yield* webhooksResponse.data;
  }
}

function ajvError(errors: Ajv2020['errors']): AggregateError | undefined {
  if (!errors || errors.length === 0) return undefined;
  return new AggregateError(
    errors.map((error) => (error.message ? new Error(error.message) : error)),
    'Validation failed'
  );
}

class WebhookValidationError<T> extends Error {
  constructor(message: string, cause?: T) {
    super(message, { cause });
    this.name = 'WebhookValidationError';
  }
}

function validateAjv<T>(
  validate: ValidateFunction<T>,
  value: unknown,
  path: string
): asserts value is T {
  if (!validate(value)) {
    throw new WebhookValidationError(
      `${path} fails validation`,
      ajvError(validate.errors)
    );
  }
}

async function validateWebhook(
  webhook: Webhook,
  request: Request,
  getBody: () => Promise<unknown>
): Promise<void> {
  // Validate the request method
  const methods = webhook.allowed_methods ?? ['POST'];
  if (!methods.includes(request.method)) {
    throw new WebhookValidationError(
      `Method "${request.method}" not allowed for webhook ${webhook.webhook_id}`
    );
  }

  // If a headers schema was provided, validate each header individually
  for (const [headerName, headerSchema] of Object.entries(
    webhook.headers_schema ?? {}
  )) {
    const header = request.headers.get(headerName);
    validateAjv(ajv.compile(headerSchema), header, `headers[${headerName}]`);
  }

  // If a search params schema was provided, validate each search param individually
  if (webhook.search_params_schema) {
    const url = new URL(request.url);

    for (const [paramName, paramSchema] of Object.entries(
      webhook.search_params_schema
    )) {
      // Handle multiple values for the same parameter name
      const allParamValues = url.searchParams.getAll(paramName);

      // If no values exist, validate null (schema should define if this is acceptable)
      // If exactly one value exists, validate as string
      // If multiple values exist, validate as array
      const paramValue =
        allParamValues.length === 0
          ? null
          : allParamValues.length === 1
            ? allParamValues[0]
            : allParamValues;

      validateAjv(ajv.compile(paramSchema), paramValue, `search[${paramName}]`);
    }
  }

  // If a body schema was provided, validate the request body
  if (webhook.body_schema) {
    const body = await getBody();
    validateAjv(ajv.compile(webhook.body_schema), body, `body`);
  }
}

async function processWebhook(
  webhook: Webhook,
  request: Request,
  getBody: () => Promise<any>
): Promise<boolean> {
  return await trace('WEBHOOK.processWebhook', async (span) => {
    try {
      await trace('WEBHOOK.validate', () =>
        validateWebhook(webhook, request, getBody)
      );
    } catch (err) {
      console.warn(String(err));
      return false;
    }

    try {
      // Create a workflow run event
      const ops: Promise<any>[] = [];
      await createWorkflowRunEvent(webhook.workflow_run_id, {
        event_type: 'webhook_request',
        event_data: {
          webhook_id: webhook.webhook_id,
          request: dehydrateStepReturnValue(request.clone(), ops, globalThis),
        },
      });
      waitUntil(Promise.all(ops));

      // TODO: maybe we should store the workflow name in the
      // webhook table to avoid this extra database fetch?
      const workflowRun = await getWorkflowRun(webhook.workflow_run_id);

      const traceCarrier = workflowRun.execution_context?.traceCarrier;

      if (traceCarrier) {
        const context = await getSpanContextForTraceCarrier(traceCarrier);
        if (context) {
          span?.addLink?.({ context });
        }
      }

      // Re-trigger the workflow
      await world.queue(`__wkf_workflow_${workflowRun.workflow_name}`, {
        runId: webhook.workflow_run_id,
        // attach the trace carrier from the workflow run
        traceCarrier: workflowRun.execution_context?.traceCarrier ?? undefined,
      } satisfies WorkflowInvokePayload);

      console.log(
        `Dispatched workflow "${workflowRun.workflow_name}" for webhook ID "${webhook.webhook_id}"`
      );
    } catch (err) {
      console.error(
        `Error creating workflow run event for webhook ${webhook.webhook_id}`,
        err
      );
      return false;
    }

    return true;
  });
}

export async function processWebhooks(
  deploymentId: string,
  request: Request,
  body?: any
): Promise<void> {
  // The request body can be passed in as an argument to the function.
  // Otherwise, clone the request and parse the body, and cache the
  // result in a Promise so that the body is only parsed once.
  let bodyPromise: Promise<any> | undefined;
  const getBody = (): Promise<any> => {
    if (bodyPromise) return bodyPromise;
    bodyPromise =
      typeof body !== 'undefined'
        ? Promise.resolve(body)
        : // TODO: maybe enforce content-type as well?
          request
            .clone()
            .json()
            .catch(() => {
              console.error('Error parsing JSON body');
              return null;
            });
    return bodyPromise;
  };

  let handledCount = 0;
  for await (const webhook of webhooksIterator(deploymentId, request)) {
    const handled = await trace('WEBHOOK.process', () =>
      processWebhook(webhook, request, getBody)
    );
    if (handled) {
      handledCount++;
    }
  }

  console.log(`Handled ${handledCount} webhooks`);
}

/**
 * A single route that handles webhook requests by validating the webhook ID,
 * registering the request to the event log and retriggers the workflow.
 *
 * @param request - The incoming `Request` instance from the webhook HTTP request.
 * @param body - (Optional) The request body. Useful for cases where the
 * request body is not JSON, or the request body needs to be consumed
 * (i.e. for signature validation) before the workflow is resumed.
 * @returns A `Response` indicating that the webhook was handled. This is
 * intentionally empty, as the webhook is handled asynchronously.
 */
export async function handleWebhook(
  request: Request,
  body?: any
): Promise<Response> {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  if (!deploymentId) {
    // This should not happen when running inside Vercel Functions
    console.error('`VERCEL_DEPLOYMENT_ID` environment variable is not set');
    return new Response('Internal server error', { status: 500 });
  }

  waitUntil(processWebhooks(deploymentId, request, body));
  return new Response('OK');
}
