import { handleCallback, type MessageMetadata, send } from '@vercel/queue';
import {
  createStep,
  createWorkflowRun,
  createWorkflowRunEvent,
  getStep,
  getWorkflowRun,
  getWorkflowRunEvents,
  updateStep,
  updateWorkflowRun,
} from './backend.js';
import { FatalError, StepNotRunError } from './global.js';
import { getStepFunction } from './private.js';
import {
  type Serializable,
  type StepInvokePayload,
  StepInvokePayloadSchema,
  type WorkflowInvokePayload,
  WorkflowInvokePayloadSchema,
} from './schemas.js';
import { getErrorName, isInstanceOf } from './types.js';
import { runWorkflow } from './workflow.js';

export { FatalError, StepNotRunError } from './global.js';

export interface StartOptions {
  arguments?: Serializable[];
  deploymentId?: string;
}

/**
 * Starts a workflow run.
 *
 * @param workflowName - The name of the workflow to start.
 * @param options - The options for the workflow run.
 * @returns The unique run ID for the newly started workflow invocation.
 */
export async function start(workflowName: string, options: StartOptions = {}) {
  const deploymentId = options.deploymentId ?? process.env.VERCEL_DEPLOYMENT_ID;
  if (!deploymentId) {
    throw new Error(
      'A `deploymentId` must be provided to start a workflow run'
    );
  }

  const run = await createWorkflowRun({
    deployment_id: deploymentId,
    workflow_name: workflowName,
    arguments: options.arguments ?? [],
  });

  // XXX: The `send()` function requires the `VERCEL_DEPLOYMENT_ID` environment
  // variable to be set. Ideally it would be accepted as an option to `send()`.
  if (!process.env.VERCEL_DEPLOYMENT_ID) {
    process.env.VERCEL_DEPLOYMENT_ID = deploymentId;
  }

  const message: WorkflowInvokePayload = {
    runId: run.id,
  };
  await send(`workflow-${workflowName}`, message);

  return run;
}

/**
 * Run a single step directly.
 *
 * @param stepId - The ID of the step to run.
 * @param options - The options for the step run.
 * @returns The unique run ID for the newly started step invocation.
 */
export async function runStep(stepId: string, options: StartOptions = {}) {
  // const baseUrl = getBaseUrl(options.baseUrl);
  // const callbackUrl = new URL(
  //   `/api/generated/steps${baseUrl.search}`,
  //   baseUrl
  // );

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
export const vercelAPIWorkflowsEntrypoint = (workflowCode: string) => {
  async function handler(message_: unknown, metadata: MessageMetadata) {
    // Extract the workflow name from the topic name
    const workflowName = metadata.topicName.slice('workflow-'.length);

    // TODO: validate `workflowName` exists before consuming message?

    const { runId } = WorkflowInvokePayloadSchema.parse(message_);
    console.log('Received workflow message:', runId, metadata);

    // Invoke user workflow
    try {
      let workflowRun = await getWorkflowRun(runId);

      if (workflowRun.status === 'pending') {
        workflowRun = await updateWorkflowRun(runId, {
          // This sets the `started_at` timestamp at the database level
          status: 'running',
        });
      }

      // TODO: ensure that *all* events are loaded into memory before
      // running, not just a paginated subset
      const events = await getWorkflowRunEvents(workflowRun.id);

      const result = await runWorkflow(
        workflowCode,
        workflowName,
        workflowRun,
        events.data
      );
      console.log('Workflow result:', result);

      // Update the workflow run with the result
      await updateWorkflowRun(runId, {
        status: 'completed',
        output: result as Serializable,
      });
    } catch (err_) {
      const err = err_;

      if (isInstanceOf(err, StepNotRunError)) {
        console.log('Step not run:', err.stepName, err.args);

        const step = await createStep(runId, {
          workflow_run_id: runId,
          step_name: err.stepName,
          step_type: 'function_call',
          execution_order: -1, // XXX: do we need this?
          arguments: err.args as Serializable[],
        });

        const stepInvokePayload: StepInvokePayload = {
          workflowName,
          workflowRunId: runId,
          stepId: step.id,
        };
        await send(`step-${err.stepName}`, stepInvokePayload);
      } else if (isInstanceOf(err, FatalError)) {
        console.error(
          `Workflow failed with a fatal error (Run ID: ${runId}): ${err}`
        );
        await updateWorkflowRun(runId, {
          status: 'failed',
          error_message: String(err),
        });
      } else {
        console.error(
          `Unexpected error while running workflow (Run ID: ${runId}): ${err}`
        );
        await updateWorkflowRun(runId, {
          status: 'failed',
          error_message: String(err),
        });
      }
    }
  }

  return handleCallback({
    'workflow-*': {
      default: handler,
    },
  });
};

async function stepMessageHandler(
  message_: unknown,
  metadata: MessageMetadata
) {
  // Extract the step name from the topic name
  const stepName = metadata.topicName.slice('step-'.length);

  const stepFn = getStepFunction(stepName);
  if (!stepFn) {
    throw new Error(`Step "${stepName}" not found`);
  }
  if (typeof stepFn !== 'function') {
    throw new Error(
      `Step "${stepName}" is not a function (got ${typeof stepFn})`
    );
  }

  const { workflowName, workflowRunId, stepId } =
    StepInvokePayloadSchema.parse(message_);
  console.log(
    'Received step invoke message:',
    { workflowName, workflowRunId, stepId },
    metadata
  );

  let result: unknown;
  try {
    let step = await getStep(workflowRunId, stepId);

    if (step.status === 'pending') {
      step = await updateStep(workflowRunId, stepId, {
        status: 'running',
      });
    } else if (step.status === 'completed') {
      console.error(`Step "${stepId}" has already completed`);
      return;
    } else if (step.status === 'failed') {
      console.error(
        `Step "${stepId}" has already failed: ${step.error_message}`
      );
      return;
    }

    result = await stepFn(...step.input);
    console.log('Step result:', result);

    // Update the event log with the step result
    await createWorkflowRunEvent(workflowRunId, {
      event_type: 'step_result',
      event_data: {
        step_id: stepId,
        result: result as Serializable,
      },
    });

    await updateStep(workflowRunId, stepId, {
      status: 'completed',
      output: result as Serializable,
    });
  } catch (err) {
    console.error(
      `${getErrorName(err)} while running "${stepId}" step (Workflow run ID: ${workflowRunId}): ${String(err)}`
    );
    if (isInstanceOf(err, FatalError)) {
      // Fatal error - store the error in the event log and re-invoke the workflow
      await createWorkflowRunEvent(workflowRunId, {
        event_type: 'step_failed',
        event_data: {
          step_id: stepId,
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
      const deliveryCount = metadata.deliveryCount;
      const maxRetries = stepFn.maxRetries ?? 32;
      if (deliveryCount >= maxRetries) {
        // Max retries reached - store the error in the event log and re-invoke the workflow
        const error = `Max retries reached`;
        await createWorkflowRunEvent(workflowRunId, {
          event_type: 'step_failed',
          event_data: {
            step_id: stepId,
            error,
          },
        });
        await updateStep(workflowRunId, stepId, {
          status: 'failed',
          error_message: error,
        });
      } else {
        const timeoutSeconds = 1;
        // it's a retryable error - so have the queue keep the message visible so that it gets retried
        return {
          timeoutSeconds,
        };
      }
    }
  }

  const workflowInvokeMessage: WorkflowInvokePayload = {
    runId: workflowRunId,
  };

  // TODO: temporary logging
  console.log(
    `Sending message back to the "${workflowName}" workflow:`,
    workflowInvokeMessage
  );

  await send(`workflow-${workflowName}`, workflowInvokeMessage);
}

/**
 * A single route that handles any step execution request and routes to the
 * appropriate step function. We may eventually want to create different bundles
 * for each step, this is temporary.
 */
export const vercelAPIStepsEntrypoint = handleCallback({
  'step-*': {
    default: stepMessageHandler,
  },
});

export * from './sleep.js';
