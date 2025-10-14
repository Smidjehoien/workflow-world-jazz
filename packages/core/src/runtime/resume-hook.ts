import { waitUntil } from '@vercel/functions';
import type { Hook } from '@vercel/workflow-world';
import type { WorkflowInvokePayload } from '../schemas.js';
import {
  dehydrateStepReturnValue,
  hydrateStepArguments,
} from '../serialization.js';
import { WEBHOOK_RESPONSE_WRITABLE } from '../symbols.js';
import * as Attribute from '../telemetry/semantic-conventions.js';
import { getSpanContextForTraceCarrier, trace } from '../telemetry.js';
import { getWorld } from './world.js';

/**
 * Get the hook by token to find the associated workflow run,
 * and hydrate the `metadata` property if it was set from within
 * the workflow run.
 *
 * @param token - The unique token identifying the hook
 */
export async function getHookByToken(token: string): Promise<Hook> {
  const world = getWorld();
  const hook = await world.hooks.getByToken(token);
  if (typeof hook.metadata !== 'undefined') {
    hook.metadata = hydrateStepArguments(hook.metadata as any, [], globalThis);
  }
  return hook;
}

/**
 * Resumes a workflow run by sending a payload to a hook identified by its token.
 *
 * This function is called externally (e.g., from an API route or server action)
 * to send data to a hook and resume the associated workflow run.
 *
 * @param token - The unique token identifying the hook
 * @param payload - The data payload to send to the hook
 * @returns Promise resolving to an object with the runId, or null if the hook doesn't exist
 *
 * @example
 *
 * ```ts
 * // In an API route
 * import { resumeHook } from '@vercel/workflow-core/runtime';
 *
 * export async function POST(request: Request) {
 *   const { token, data } = await request.json();
 *   const result = await resumeHook(token, data);
 *
 *   if (!result) {
 *     return new Response('Hook not found', { status: 404 });
 *   }
 *
 *   return Response.json({ runId: result.runId });
 * }
 * ```
 */
export async function resumeHook<T = any>(
  token: string,
  payload: T
): Promise<Hook | null> {
  return trace('HOOK.resume', async (span) => {
    const world = getWorld();

    try {
      const hook = await getHookByToken(token);

      span?.setAttributes({
        ...Attribute.HookToken(token),
        ...Attribute.HookId(hook.hookId),
        ...Attribute.WorkflowRunId(hook.runId),
      });

      // Dehydrate the payload for storage
      const ops: Promise<any>[] = [];
      const dehydratedPayload = dehydrateStepReturnValue(
        payload,
        ops,
        globalThis
      );
      //console.log('dehydratedPayload', dehydratedPayload);
      waitUntil(Promise.all(ops));

      // Create a hook_received event with the payload
      await world.events.create(hook.runId, {
        eventType: 'hook_received',
        correlationId: hook.hookId,
        eventData: {
          payload: dehydratedPayload,
        },
      });

      const workflowRun = await world.runs.get(hook.runId);

      span?.setAttributes({
        ...Attribute.WorkflowName(workflowRun.workflowName),
      });

      const traceCarrier = workflowRun.executionContext?.traceCarrier;

      if (traceCarrier) {
        const context = await getSpanContextForTraceCarrier(traceCarrier);
        if (context) {
          span?.addLink?.({ context });
        }
      }

      // Re-trigger the workflow against the deployment ID associated
      // with the workflow run that the hook belongs to
      await world.queue(
        `__wkf_workflow_${workflowRun.workflowName}`,
        {
          runId: hook.runId,
          // attach the trace carrier from the workflow run
          traceCarrier: workflowRun.executionContext?.traceCarrier ?? undefined,
        } satisfies WorkflowInvokePayload,
        {
          deploymentId: workflowRun.deploymentId,
        }
      );

      return hook;
    } catch (_err) {
      // If hook not found, return null
      span?.setAttributes({
        ...Attribute.HookToken(token),
        ...Attribute.HookFound(false),
      });
      // TODO: Check for specific error types
      return null;
    }
  });
}

/**
 * Resumes a webhook by sending a {@link https://developer.mozilla.org/en-US/docs/Web/API/Request | Request}
 * object to a hook identified by its token.
 *
 * This function is called externally (e.g., from an API route or server action)
 * to send a request to a webhook and resume the associated workflow run.
 *
 * @param token - The unique token identifying the hook
 * @param request - The request to send to the hook
 * @returns Promise resolving to the response, or null if the hook doesn't exist
 *
 * @example
 *
 * ```ts
 * // In an API route
 * import { resumeWebhook } from '@vercel/workflow-core/runtime';
 *
 * export async function POST(request: Request) {
 *   const url = new URL(request.url);
 *   const token = url.searchParams.get('token');
 *
 *   if (!token) {
 *     return new Response('Missing token', { status: 400 });
 *   }
 *
 *   const response = await resumeWebhook(token, request);
 *
 *   return response ?? new Response('Webhook not found', { status: 404 });
 * }
 * ```
 */
export async function resumeWebhook(
  token: string,
  request: Request
): Promise<Response | null> {
  const { readable, writable } = new TransformStream<Response, Response>();

  // The request instance includes the writable stream which will be used
  // to write the response to the client from within the workflow run
  (request as any)[WEBHOOK_RESPONSE_WRITABLE] = writable;

  const hook = await resumeHook(token, request);
  if (!hook) return null;

  // Wait for the readable stream to emit one chunk,
  // which is the Response object
  const reader = readable.getReader();
  const response = await reader.read();
  if (response.done) return null;
  reader.cancel();
  return response.value;
}
