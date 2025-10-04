import { waitUntil } from '@vercel/functions';
import type { Hook } from '@vercel/workflow-world';
import type { WorkflowInvokePayload } from '../schemas.js';
import { dehydrateStepReturnValue } from '../serialization.js';
import * as Attribute from '../telemetry/semantic-conventions.js';
import { getSpanContextForTraceCarrier, trace } from '../telemetry.js';
import { getWorld } from './world.js';

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
      // Get the hook by token to find the associated workflow run
      const hook = await world.hooks.getByToken(token);

      span?.setAttributes({
        'workflow.hook.token': token,
        'workflow.hook.id': hook.hookId,
        ...Attribute.WorkflowRunId(hook.runId),
      });

      // Dehydrate the payload for storage
      const ops: Promise<any>[] = [];
      const dehydratedPayload = dehydrateStepReturnValue(
        payload,
        ops,
        globalThis
      );
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
        'workflow.hook.token': token,
        'workflow.hook.found': false,
      });
      // TODO: Check for specific error types
      return null;
    }
  });
}
