import { waitUntil } from '@vercel/functions';
import { world } from './adapters/index.js';
import {
  createStep,
  createWorkflowRun,
  createWorkflowRunEvent,
  getStep,
  getWorkflowRunEvents,
  getWorkflowRun as getWorkflowRunFromDB,
  updateStep,
  updateWorkflowRun,
  WorkflowAPIError,
  type WorkflowRun,
} from './backend.js';
import { FatalError, RetryableError, StepsNotRunError } from './global.js';
import { getStepFunction } from './private.js';
import {
  type Serializable,
  type StepInvokePayload,
  StepInvokePayloadSchema,
  type WorkflowInvokePayload,
  WorkflowInvokePayloadSchema,
} from './schemas.js';
import {
  dehydrateStepArguments,
  dehydrateStepReturnValue,
  dehydrateWorkflowArguments,
  hydrateStepArguments,
  hydrateWorkflowReturnValue,
} from './serialization.js';
// TODO: move step handler out to a separate file
import { contextStorage } from './step/use-context.js';
import { getErrorName, getErrorStack, isInstanceOf } from './types.js';
import type { WorkflowContext } from './use-context.js';
import { runWorkflow } from './workflow.js';

export { StepsNotRunError } from './global.js';

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
  let args: Serializable[] = [];
  let opts: StartOptions = options ?? {};
  if (Array.isArray(argsOrOptions)) {
    args = argsOrOptions;
  } else if (typeof argsOrOptions === 'object') {
    opts = argsOrOptions;
  }

  const deploymentId = opts.deploymentId ?? (await world.getDeploymentId());
  const ops: Promise<void>[] = [];
  const workflowArguments = dehydrateWorkflowArguments(args, ops);
  const run = await createWorkflowRun({
    deployment_id: deploymentId,
    workflow_name: workflowName,
    arguments: workflowArguments,
  });
  waitUntil(Promise.all(ops));

  // XXX: The `send()` function requires the `VERCEL_DEPLOYMENT_ID` environment
  // variable to be set. Ideally it would be accepted as an option to `send()`.
  if (!process.env.VERCEL_DEPLOYMENT_ID) {
    process.env.VERCEL_DEPLOYMENT_ID = deploymentId;
  }

  await world.queue(`__wkf_workflow_${workflowName}`, {
    runId: run.id,
  } satisfies WorkflowInvokePayload);

  return run;
}

export async function getWorkflowRun(runId: string) {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  if (!deploymentId) {
    throw new Error('A `deploymentId` must be provided to get a workflow run');
  }
  return getWorkflowRunFromDB(runId);
}

export async function getWorkflowReturnValue(
  runId: string,
  ops: Promise<any>[] = [],
  global: Record<string, any> = globalThis
) {
  const run = await getWorkflowRun(runId);
  if (run.status !== 'completed') {
    throw new Error('Workflow run is not completed');
  }
  return hydrateWorkflowReturnValue(run.output as any, ops, global);
}

/**
 * Run a single step directly.
 *
 * @param stepId - The ID of the step to run.
 * @param options - The options for the step run.
 * @returns The unique run ID for the newly started step invocation.
 */
export async function runStep(_stepId: string, _options: StartOptions = {}) {
  throw new Error('Running steps directly is not yet implemented');
}

// ---------------------------------------------------------

/**
 * Function that creates a single route which handles any workflow execution
 * request and routes to the appropriate workflow function.
 *
 * @param workflowCode - The workflow bundle code containing all the workflow
 * functions at the top level.
 * @returns A function that can be used as a Vercel API route.
 */
export function vercelAPIWorkflowsEntrypoint(workflowCode: string) {
  return world.createQueueHandler(
    '__wkf_workflow_',
    async (message_, metadata) => {
      // Extract the workflow name from the topic name
      const workflowName = metadata.queueName.slice('__wkf_workflow_'.length);

      // TODO: validate `workflowName` exists before consuming message?

      const { runId } = WorkflowInvokePayloadSchema.parse(message_);

      // Invoke user workflow
      let workflowStartedAt = -1;
      try {
        let workflowRun = await getWorkflowRun(runId);

        if (workflowRun.status === 'pending') {
          workflowRun = await updateWorkflowRun(runId, {
            // This sets the `started_at` timestamp at the database level
            status: 'running',
          });
          if (!workflowRun.started_at) {
            throw new Error(
              `Workflow run "${runId}" has no "started_at" timestamp`
            );
          }
          workflowStartedAt = +workflowRun.started_at;
        }

        if (workflowRun.status !== 'running') {
          // Workflow has already completed or failed, so we can skip it
          console.warn(
            `Workflow "${runId}" has status "${workflowRun.status}", skipping`
          );
          return;
        }

        // TODO: ensure that *all* events are loaded into memory before
        // running, not just a paginated subset
        const events = await getWorkflowRunEvents(workflowRun.id);

        const result = await runWorkflow(
          workflowCode,
          workflowRun,
          events.data
        );

        // Update the workflow run with the result
        await updateWorkflowRun(runId, {
          status: 'completed',
          output: result as Serializable,
        });
      } catch (err) {
        if (isInstanceOf(err, StepsNotRunError)) {
          // Create a step for each step that was not run and enqueue the step invocations
          for (const stepEntry of err.steps) {
            const ops: Promise<void>[] = [];
            const dehydratedArgs = dehydrateStepArguments(
              stepEntry.args,
              err.globalThis
            );

            try {
              const step = await createStep(runId, {
                workflow_run_id: runId,
                invocation_id: stepEntry.invocationId,
                step_name: stepEntry.stepName,
                step_type: 'function_call',
                arguments: dehydratedArgs as Serializable[],
              });

              waitUntil(Promise.all(ops));

              await world.queue(
                `__wkf_step_${stepEntry.stepName}`,
                {
                  workflowName,
                  workflowStartedAt,
                  workflowRunId: runId,
                  stepId: step.id,
                } satisfies StepInvokePayload,
                {
                  idempotencyKey: stepEntry.invocationId,
                }
              );
            } catch (err) {
              if (isInstanceOf(err, WorkflowAPIError) && err.status === 409) {
                // Step already exists, so we can skip it
                console.warn(
                  `Step "${stepEntry.stepName}" with invocation ID "${stepEntry.invocationId}" already exists, skipping: ${err.message}`
                );
                continue;
              }
              throw err;
            }
          }
        } else if (isInstanceOf(err, Error)) {
          const errorName = getErrorName(err);
          const errorStack = getErrorStack(err);
          console.error(
            `${errorName} while running "${runId}" workflow:\n\n${errorStack}`
          );
          await updateWorkflowRun(runId, {
            status: 'failed',
            error_name: errorName,
            error_stack: errorStack,
            error_message: String(err),
          });
        } else {
          console.error(
            `${getErrorName(
              err
            )} while running "${runId}" workflow:\n\n${getErrorStack(err)}`
          );
          await updateWorkflowRun(runId, {
            status: 'failed',
            error_message: String(err),
          });
        }
      }
    }
  );
}

/**
 * A single route that handles any step execution request and routes to the
 * appropriate step function. We may eventually want to create different bundles
 * for each step, this is temporary.
 */
export const vercelAPIStepsEntrypoint =
  /* @__PURE__ */ world.createQueueHandler(
    '__wkf_step_',
    async (message_, metadata) => {
      // Extract the step name from the topic name
      const stepName = metadata.queueName.slice('__wkf_step_'.length);

      const stepFn = getStepFunction(stepName);
      if (!stepFn) {
        throw new Error(`Step "${stepName}" not found`);
      }
      if (typeof stepFn !== 'function') {
        throw new Error(
          `Step "${stepName}" is not a function (got ${typeof stepFn})`
        );
      }

      const { workflowName, workflowRunId, stepId, workflowStartedAt } =
        StepInvokePayloadSchema.parse(message_);

      let step = await getStep(workflowRunId, stepId);

      let result: unknown;
      try {
        if (step.status === 'pending') {
          step = await updateStep(workflowRunId, stepId, {
            status: 'running',
          });
          await createWorkflowRunEvent(workflowRunId, {
            event_type: 'step_started',
            event_data: {
              step_id: stepId,
              invocation_id: step.invocation_id,
            },
          });
        }

        if (step.status !== 'running') {
          console.error(
            `Step "${stepId}" has status "${step.status}", skipping${step.error_message ? `: ${step.error_message}` : ''}`
          );
          return;
        }

        // Hydrate the step input arguments
        const ops: Promise<void>[] = [];
        const args = hydrateStepArguments(step.input, ops);

        const ctx: WorkflowContext = {
          workflowRunId,
          workflowStartedAt: new Date(workflowStartedAt),
          stepId: step.invocation_id,
          attempt: metadata.attempt,
          url: `https://${process.env.VERCEL_URL}`,
        };
        contextStorage.enterWith(ctx);

        result = await stepFn(...args);

        result = dehydrateStepReturnValue(result, ops);

        waitUntil(Promise.all(ops));

        // Update the event log with the step result
        await createWorkflowRunEvent(workflowRunId, {
          event_type: 'step_result',
          event_data: {
            step_id: stepId,
            invocation_id: step.invocation_id,
            result: result as Serializable,
          },
        });

        await updateStep(workflowRunId, stepId, {
          status: 'completed',
          output: result as Serializable,
        });
      } catch (err: unknown) {
        console.error(
          `${getErrorName(
            err
          )} while running "${stepId}" step (Workflow run ID: ${workflowRunId}):\n\n${getErrorStack(
            err
          )}`
        );
        if (isInstanceOf(err, FatalError)) {
          // Fatal error - store the error in the event log and re-invoke the workflow
          await createWorkflowRunEvent(workflowRunId, {
            event_type: 'step_failed',
            event_data: {
              step_id: stepId,
              invocation_id: step.invocation_id,
              error: String(err),
              stack: err.stack,
              fatal: true,
            },
          });
          await updateStep(workflowRunId, stepId, {
            status: 'failed',
            error_message: String(err),
          });
        } else {
          const attempt = metadata.attempt;
          const maxRetries = stepFn.maxRetries ?? 32;
          if (attempt >= maxRetries) {
            // Max retries reached - store the error in the event log and re-invoke the workflow
            const error = `Max retries reached`;
            await createWorkflowRunEvent(workflowRunId, {
              event_type: 'step_failed',
              event_data: {
                step_id: stepId,
                invocation_id: step.invocation_id,
                error,
                fatal: true,
              },
            });
            await updateStep(workflowRunId, stepId, {
              status: 'failed',
              error_message: error,
            });
          } else {
            await createWorkflowRunEvent(workflowRunId, {
              event_type: 'step_failed',
              event_data: {
                step_id: stepId,
                invocation_id: step.invocation_id,
                error: String(err),
                stack: getErrorStack(err),
              },
            });
            const timeoutSeconds = Math.max(
              1,
              isInstanceOf(err, RetryableError)
                ? Math.floor((+err.retryAfter.getTime() - Date.now()) / 1000)
                : 1
            );
            // It's a retryable error - so have the queue keep the message visible
            // so that it gets retried.
            return { timeoutSeconds };
          }
        }
      } finally {
        contextStorage.disable();
      }

      await world.queue(`__wkf_workflow_${workflowName}`, {
        runId: workflowRunId,
      } satisfies WorkflowInvokePayload);
    }
  );

export { vercelAPIWebhooksEntrypoint } from './runtime/webhook.js';
