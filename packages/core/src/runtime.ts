import { waitUntil } from '@vercel/functions';
import { world } from './adapters/index.js';
import {
  createStep,
  createWebhook,
  createWorkflowRunEvent,
  getStep,
  getWorkflowRunEvents,
  getWorkflowRun as getWorkflowRunFromDB,
  updateStep,
  updateWorkflowRun,
  WorkflowAPIError,
} from './backend.js';
import {
  WorkflowRunFailedError,
  WorkflowRunNotCompletedError,
} from './errors.js';
import type { WorkflowContext } from './get-context.js';
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
  hydrateStepArguments,
  hydrateWorkflowReturnValue,
} from './serialization.js';
// TODO: move step handler out to a separate file
import { contextStorage } from './step/get-context.js';
import * as Attribute from './telemetry/semantic-conventions.js';
import { serializeTraceCarrier, trace, withTraceContext } from './telemetry.js';
import { getErrorName, getErrorStack, isInstanceOf } from './types.js';
import { runWorkflow } from './workflow.js';

export { StepsNotRunError } from './global.js';
export { type StartOptions, start } from './runtime/start.js';
export { handleWebhook, processWebhooks } from './runtime/webhook.js';

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

  if (run.status === 'completed' || run.status === 'cancelled') {
    return hydrateWorkflowReturnValue(run.output as any, ops, global);
  }

  if (run.status === 'failed') {
    throw new WorkflowRunFailedError(
      runId,
      run.error_message ?? 'Unknown error'
    );
  }

  throw new WorkflowRunNotCompletedError(runId, run.status);
}

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
      const { runId, traceCarrier: traceContext } =
        WorkflowInvokePayloadSchema.parse(message_);
      // Extract the workflow name from the topic name
      const workflowName = metadata.queueName.slice('__wkf_workflow_'.length);

      // Invoke user workflow within the propagated trace context
      return await withTraceContext(traceContext, async () => {
        return trace(`WORKFLOW ${workflowName}`, async (span) => {
          span?.setAttributes({
            ...Attribute.WorkflowName(workflowName),
            ...Attribute.WorkflowOperation('execute'),
            ...Attribute.QueueName(metadata.queueName),
          });

          // TODO: validate `workflowName` exists before consuming message?

          span?.setAttributes({
            ...Attribute.WorkflowRunId(runId),
            ...Attribute.WorkflowTracePropagated(!!traceContext),
          });

          let workflowStartedAt = -1;
          try {
            let workflowRun = await getWorkflowRun(runId);

            if (workflowRun.status === 'pending') {
              workflowRun = await updateWorkflowRun(runId, {
                // This sets the `started_at` timestamp at the database level
                status: 'running',
              });
            }

            // At this point, the workflow is "running" and `started_at` should
            // definitely be set.
            if (!workflowRun.started_at) {
              throw new Error(
                `Workflow run "${runId}" has no "started_at" timestamp`
              );
            }
            workflowStartedAt = +workflowRun.started_at;

            span?.setAttributes({
              ...Attribute.WorkflowRunStatus(workflowRun.status),
              ...Attribute.WorkflowStartedAt(workflowStartedAt),
            });

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

            span?.setAttributes({
              ...Attribute.WorkflowRunStatus('completed'),
              ...Attribute.WorkflowEventsCount(events.data.length),
            });
          } catch (err) {
            if (isInstanceOf(err, StepsNotRunError)) {
              // Process each operation in the queue (steps and webhooks)
              for (const queueItem of err.steps) {
                if (queueItem.type === 'step') {
                  // Handle step operations
                  const ops: Promise<void>[] = [];
                  const dehydratedArgs = dehydrateStepArguments(
                    queueItem.args,
                    err.globalThis
                  );

                  try {
                    const step = await createStep(runId, {
                      workflow_run_id: runId,
                      invocation_id: queueItem.invocationId,
                      step_name: queueItem.stepName,
                      step_type: 'function_call',
                      arguments: dehydratedArgs as Serializable[],
                    });

                    waitUntil(Promise.all(ops));

                    await world.queue(
                      `__wkf_step_${queueItem.stepName}`,
                      {
                        workflowName,
                        workflowStartedAt,
                        workflowRunId: runId,
                        stepId: step.id,
                        traceCarrier: await serializeTraceCarrier(),
                      } satisfies StepInvokePayload,
                      {
                        idempotencyKey: queueItem.invocationId,
                      }
                    );
                  } catch (err) {
                    if (
                      isInstanceOf(err, WorkflowAPIError) &&
                      err.status === 409
                    ) {
                      // Step already exists, so we can skip it
                      console.warn(
                        `Step "${queueItem.stepName}" with invocation ID "${queueItem.invocationId}" already exists, skipping: ${err.message}`
                      );
                      continue;
                    }
                    throw err;
                  }
                } else if (queueItem.type === 'webhook') {
                  // Handle webhook operations
                  try {
                    // Create webhook in database
                    await createWebhook(queueItem.webhookData);

                    // Create webhook_created event in event log
                    await createWorkflowRunEvent(runId, {
                      event_type: 'webhook_created',
                      event_data: {
                        webhook_id: queueItem.webhookId,
                      },
                    });

                    console.log(
                      `Created webhook "${queueItem.webhookId}" for workflow run "${runId}"`
                    );
                  } catch (err) {
                    if (isInstanceOf(err, WorkflowAPIError)) {
                      if (err.status === 409) {
                        // Webhook already exists (duplicate webhook_id constraint), so we can skip it
                        console.warn(
                          `Webhook "${queueItem.webhookId}" already exists, skipping: ${err.message}`
                        );
                        continue;
                      } else if (err.status === 410) {
                        // Workflow has already completed, so no-op
                        console.warn(
                          `Workflow run "${runId}" has already completed, skipping webhook "${queueItem.webhookId}": ${err.message}`
                        );
                        continue;
                      }
                    }
                    throw err;
                  }
                }
              }
              span?.setAttributes({
                ...Attribute.WorkflowRunStatus('pending_steps'),
                ...Attribute.WorkflowStepsCreated(err.steps.length),
              });
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
              span?.setAttributes({
                ...Attribute.WorkflowRunStatus('failed'),
                ...Attribute.WorkflowErrorName(errorName),
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
              span?.setAttributes({
                ...Attribute.WorkflowRunStatus('failed'),
                ...Attribute.WorkflowErrorMessage(String(err)),
              });
            }
          }
        }); // End withTraceContext
      });
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
      const {
        workflowName,
        workflowRunId,
        stepId,
        workflowStartedAt,
        traceCarrier: traceContext,
      } = StepInvokePayloadSchema.parse(message_);
      // Execute step within the propagated trace context
      return await withTraceContext(traceContext, async () => {
        // Extract the step name from the topic name
        const stepName = metadata.queueName.slice('__wkf_step_'.length);

        return trace(`STEP ${stepName}`, async (span) => {
          span?.setAttributes({
            ...Attribute.StepName(stepName),
            ...Attribute.StepAttempt(metadata.attempt),
            ...Attribute.QueueName(metadata.queueName),
          });

          const stepFn = getStepFunction(stepName);
          if (!stepFn) {
            throw new Error(`Step "${stepName}" not found`);
          }
          if (typeof stepFn !== 'function') {
            throw new Error(
              `Step "${stepName}" is not a function (got ${typeof stepFn})`
            );
          }

          span?.setAttributes({
            ...Attribute.WorkflowName(workflowName),
            ...Attribute.WorkflowRunId(workflowRunId),
            ...Attribute.StepId(stepId),
            ...Attribute.StepMaxRetries(stepFn.maxRetries ?? 32),
            ...Attribute.StepTracePropagated(!!traceContext),
          });

          let step = await getStep(workflowRunId, stepId);

          span?.setAttributes({
            ...Attribute.StepStatus(step.status),
            ...Attribute.StepRetryCount(step.retry_count),
          });

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
              span?.setAttributes({
                ...Attribute.StepSkipped(true),
                ...Attribute.StepSkipReason(step.status),
              });
              return;
            }

            if (!step.started_at) {
              throw new Error(`Step "${stepId}" has no "started_at" timestamp`);
            }

            // Hydrate the step input arguments
            const ops: Promise<void>[] = [];
            const args = hydrateStepArguments(step.input, ops);

            span?.setAttributes({
              ...Attribute.StepArgumentsCount(args.length),
            });

            const ctx: WorkflowContext = {
              workflowRunId,
              workflowStartedAt: new Date(workflowStartedAt),
              stepId: step.invocation_id,
              stepStartedAt: new Date(+step.started_at),
              attempt: metadata.attempt,
              url: `https://${process.env.VERCEL_URL}`,
            };
            result = await contextStorage.run(ctx, () => stepFn(...args));

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

            span?.setAttributes({
              ...Attribute.StepStatus('completed'),
              ...Attribute.StepResultType(typeof result),
            });
          } catch (err: unknown) {
            span?.setAttributes({
              ...Attribute.StepErrorName(getErrorName(err)),
              ...Attribute.StepErrorMessage(String(err)),
            });

            if (isInstanceOf(err, WorkflowAPIError)) {
              if (err.status === 410) {
                // Workflow has already completed, so no-op
                console.warn(
                  `Workflow run "${workflowRunId}" has already completed, skipping step "${stepId}": ${err.message}`
                );
                return;
              }
            }

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

              span?.setAttributes({
                ...Attribute.StepStatus('failed'),
                ...Attribute.StepFatalError(true),
              });
            } else {
              const attempt = metadata.attempt;
              const maxRetries = stepFn.maxRetries ?? 32;

              span?.setAttributes({
                ...Attribute.StepAttempt(attempt),
                ...Attribute.StepMaxRetries(maxRetries),
              });

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

                span?.setAttributes({
                  ...Attribute.StepStatus('failed'),
                  ...Attribute.StepRetryExhausted(true),
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
                    ? Math.floor(
                        (+err.retryAfter.getTime() - Date.now()) / 1000
                      )
                    : 1
                );

                span?.setAttributes({
                  ...Attribute.StepRetryTimeoutSeconds(timeoutSeconds),
                  ...Attribute.StepRetryWillRetry(true),
                });

                // It's a retryable error - so have the queue keep the message visible
                // so that it gets retried.
                return { timeoutSeconds };
              }
            }
          }

          await world.queue(`__wkf_workflow_${workflowName}`, {
            runId: workflowRunId,
            traceCarrier: await serializeTraceCarrier(),
          } satisfies WorkflowInvokePayload);
        });
      });
    }
  );

// this is a no-op placeholder as the client is
// expecting this to be present but we aren't actually using it
export function runStep() {}
