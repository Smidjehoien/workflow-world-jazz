import { waitUntil } from '@vercel/functions';
import { world } from '../adapters/index.js';
import { createWorkflowRun, type WorkflowRun } from '../backend/index.js';
import type { Serializable, WorkflowInvokePayload } from '../schemas.js';
import { dehydrateWorkflowArguments } from '../serialization.js';
import * as Attribute from '../telemetry/semantic-conventions.js';
import { serializeTraceCarrier, trace } from '../telemetry.js';

export interface StartOptions {
  deploymentId?: string;
}

/**
 * Starts a workflow run.
 *
 * @param workflowName - The name of the workflow to start.
 * @param args - The arguments to pass to the workflow (optional).
 * @param options - The options for the workflow run (optional).
 * @returns The unique run ID for the newly started workflow invocation.
 */
export function start(
  workflowName: string,
  args: Serializable[],
  options?: StartOptions
): Promise<WorkflowRun>;
export function start(
  workflowName: string,
  options?: StartOptions
): Promise<WorkflowRun>;
export async function start(
  workflowName: string,
  argsOrOptions?: Serializable[] | StartOptions,
  options?: StartOptions
) {
  return trace(`WORKFLOW.start ${workflowName}`, async (span) => {
    span?.setAttributes({
      ...Attribute.WorkflowName(workflowName),
      ...Attribute.WorkflowOperation('start'),
    });

    let args: Serializable[] = [];
    let opts: StartOptions = options ?? {};
    if (Array.isArray(argsOrOptions)) {
      args = argsOrOptions;
    } else if (typeof argsOrOptions === 'object') {
      opts = argsOrOptions;
    }

    span?.setAttributes({
      ...Attribute.WorkflowArgumentsCount(args.length),
    });

    const deploymentId = opts.deploymentId ?? (await world.getDeploymentId());
    const ops: Promise<void>[] = [];
    const workflowArguments = dehydrateWorkflowArguments(args, ops);
    // Serialize current trace context to propagate across queue boundary
    const traceCarrier = await serializeTraceCarrier();

    const run = await createWorkflowRun({
      deploymentId: deploymentId,
      workflowName: workflowName,
      input: workflowArguments,
      executionContext: { traceCarrier },
    });
    waitUntil(Promise.all(ops));

    span?.setAttributes({
      ...Attribute.WorkflowRunId(run.runId),
      ...Attribute.WorkflowRunStatus(run.status),
      ...Attribute.DeploymentId(deploymentId),
    });

    // XXX: The `send()` function requires the `VERCEL_DEPLOYMENT_ID` environment
    // variable to be set. Ideally it would be accepted as an option to `send()`.
    if (!process.env.VERCEL_DEPLOYMENT_ID) {
      process.env.VERCEL_DEPLOYMENT_ID = deploymentId;
    }

    await world.queue(`__wkf_workflow_${workflowName}`, {
      runId: run.runId,
      traceCarrier,
    } satisfies WorkflowInvokePayload);

    return run;
  });
}
