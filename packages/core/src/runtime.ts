import { waitUntil } from '@vercel/functions';
import { handleCallback, type MessageMetadata, send } from '@vercel/queue';
import {
  createStep,
  createWorkflowRun,
  createWorkflowRunEvent,
  DEFAULT_CONFIG,
  getStep,
  getWorkflowRun,
  getWorkflowRunEvents,
  updateStep,
  updateWorkflowRun,
} from './backend.js';
import { FatalError, StepsNotRunError } from './global.js';
import { getStepFunction } from './private.js';
import {
  type Serializable,
  type StepInvokePayload,
  StepInvokePayloadSchema,
  type WorkflowInvokePayload,
  WorkflowInvokePayloadSchema,
} from './schemas.js';
import { getErrorName, getErrorStack, isInstanceOf } from './types.js';
import { runWorkflow } from './workflow.js';

export { StepsNotRunError } from './global.js';

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

      const result = await runWorkflow(workflowCode, workflowRun, events.data);
      console.log('Workflow result:', result);

      // Update the workflow run with the result
      await updateWorkflowRun(runId, {
        status: 'completed',
        output: result as Serializable,
      });
    } catch (err) {
      if (isInstanceOf(err, StepsNotRunError)) {
        console.log('Steps not run:', err.steps);

        // Create a step for each step that was not run and enqueue the step invocations
        for (const stepEntry of err.steps) {
          const step = await createStep(runId, {
            workflow_run_id: runId,
            invocation_id: stepEntry.invocationId,
            step_name: stepEntry.stepName,
            step_type: 'function_call',
            arguments: stepEntry.args as Serializable[],
          });

          const stepInvokePayload: StepInvokePayload = {
            workflowName,
            workflowRunId: runId,
            stepId: step.id,
          };
          await send(`step-${stepEntry.stepName}`, stepInvokePayload);
        }
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
    } else if (step.status === 'completed') {
      console.error(`Step "${stepId}" has already completed`);
      return;
    } else if (step.status === 'failed') {
      console.error(
        `Step "${stepId}" has already failed: ${step.error_message}`
      );
      return;
    }

    // Hydrate the step input arguments
    const args = (await deserialize(step.input)) as Serializable[];

    result = await stepFn(...args);
    console.log('Step result:', result);

    // Pass over the result value to prepare for asyncronous serialization
    // of TypedArray / ReadableStream values.
    const ops: Promise<void>[] = [];
    result = serialize(result, ops);
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
      `${getErrorName(err)} while running "${stepId}" step (Workflow run ID: ${workflowRunId}): ${String(err)}\n${getErrorStack(err)}`
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
      const deliveryCount = metadata.deliveryCount;
      const maxRetries = stepFn.maxRetries ?? 32;
      if (deliveryCount >= maxRetries) {
        // Max retries reached - store the error in the event log and re-invoke the workflow
        const error = `Max retries reached`;
        await createWorkflowRunEvent(workflowRunId, {
          event_type: 'step_failed',
          event_data: {
            step_id: stepId,
            invocation_id: step.invocation_id,
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
export const vercelAPIStepsEntrypoint = /* @__PURE__ */ handleCallback({
  'step-*': {
    default: stepMessageHandler,
  },
});

const WRITABLE_STREAM_BASE_URL = DEFAULT_CONFIG.baseUrl;

class WorkflowServerWritableStream extends WritableStream<Uint8Array> {
  constructor(name: string) {
    super({
      write: async (chunk) => {
        console.log(
          'Writing chunk to stream:',
          JSON.stringify(new TextDecoder().decode(chunk))
        );
        await fetch(`${WRITABLE_STREAM_BASE_URL}/api/stream/${name}`, {
          method: 'PUT',
          body: chunk,
          duplex: 'half',
        });
      },
      close: async () => {
        console.log('Closing stream:', name);
        await fetch(`${WRITABLE_STREAM_BASE_URL}/api/stream/${name}`, {
          method: 'PUT',
          headers: {
            'X-Stream-Done': 'true',
          },
        });
      },
    });
  }
}

function serialize(result: unknown, ops: Promise<void>[]): unknown {
  if (result instanceof ReadableStream) {
    const name = crypto.randomUUID();
    const stream = new WorkflowServerWritableStream(name);
    ops.push(result.pipeTo(stream));
    return { __type: 'ReadableStream', name };
  }

  if (result instanceof Response) {
    return {
      __type: 'Response',
      status: result.status,
      statusText: result.statusText,
      headers: Object.fromEntries(result.headers.entries()),
      body: serialize(result.body, ops),
    };
  }

  if (result && typeof result === 'object') {
    const entries = Object.entries(result);
    const hydrated: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      hydrated[key] = serialize(value, ops);
    }
    return hydrated;
  }

  if (Array.isArray(result)) {
    return result.map((value) => serialize(value, ops));
  }

  return result;
}

async function deserialize(result: unknown): Promise<unknown> {
  if (result && typeof result === 'object' && '__type' in result) {
    if (result.__type === 'ReadableStream') {
      const name = (result as any).name;
      const res = await fetch(`${WRITABLE_STREAM_BASE_URL}/api/stream/${name}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch stream: ${res.statusText}`);
      }
      return res.body;
    }

    if (result.__type === 'Response') {
      const body = (await deserialize((result as any).body)) as ReadableStream;
      return new Response(body, {
        status: (result as any).status,
        statusText: (result as any).statusText,
        headers: new Headers((result as any).headers),
      });
    }
  }

  if (Array.isArray(result)) {
    return Promise.all(result.map(deserialize));
  }

  if (result && typeof result === 'object') {
    // Recursively deserialize each property of the object
    const entries = Object.entries(result as Record<string, unknown>);
    const deserialized: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      deserialized[key] = await deserialize(value);
    }
    return deserialized;
  }

  return result;
}
