import {
  InvalidCallbackError,
  type MessageHandler,
  parseCallbackRequest,
  QueueClient,
  send,
  Topic,
} from '@vercel/queue';
import ms, { type StringValue } from 'ms';
import { getBaseUrl } from './base-url.js';
import { FatalError, StepNotRunError } from './global.js';
import { getStepFunction, type StepFunction } from './private.js';
import type {
  Serializable,
  StepInvokePayload,
  WorkflowEvent,
  WorkflowInvokePayload,
} from './schemas.js';
import { getErrorName, isInstanceOf } from './types.js';
import { runWorkflow } from './workflow.js';

export { FatalError, StepNotRunError } from './global.js';

export interface StartOptions {
  arguments?: Serializable[];
  baseUrl?: string;
}

/**
 * Starts a workflow run.
 *
 * @param workflowId - The ID of the workflow to start.
 * @param options - The options for the workflow run.
 * @returns The unique run ID for the newly started workflow invocation.
 */
export async function start(workflowId: string, options: StartOptions = {}) {
  const baseUrl = getBaseUrl(options.baseUrl);
  const callbackUrl = new URL(
    `/api/generated/workflows${baseUrl.search}`,
    baseUrl
  );

  const runId = crypto.randomUUID();
  const payload: WorkflowInvokePayload = {
    workflowId,
    runId,
    callbackUrl: callbackUrl.href,
    state: [{ t: Date.now(), arguments: options.arguments ?? [] }],
  };
  const queueResult = await send(`workflow-${workflowId}`, payload, {
    callback: {
      url: callbackUrl.href,
      delay: 0,
    },
  });
  return { runId, ...queueResult };
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
 * A single route that handles any workflow execution request and routes to the
 * appropriate workflow function.
 *
 * @param workflowCode - The workflow bundle code containing all the workflow
 * functions at the top level.
 * @returns A function that can be used as a Vercel API route.
 */
export function vercelAPIWorkflowsEntrypoint(
  workflowCode: string
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      // Parse the queue callback information
      const { queueName, consumerGroup, messageId } =
        parseCallbackRequest(request);

      // Ensure we're handling a `workflow` topic
      if (!queueName.startsWith('workflow-')) {
        throw new Error(`Expected 'workflow-*' topic, got '${queueName}'`);
      }

      // Ensure the consumer group is 'default'
      if (consumerGroup !== 'default') {
        throw new Error(
          `Expected 'default' consumer group, got '${consumerGroup}'`
        );
      }

      // extract the workflow name from the queue name
      const workflowName = queueName.slice('workflow-'.length);
      // TODO: validate `workflowName` exists before consuming message?

      // Create client and process the message
      const client = new QueueClient();
      const topic = new Topic(client, queueName);
      const cg = topic.consumerGroup(consumerGroup);

      await cg.consume(workflowMessageHandler(workflowCode, workflowName), {
        messageId,
      });

      return Response.json({ status: 'success' });
    } catch (error) {
      console.error('Callback error:', error);

      if (error instanceof InvalidCallbackError) {
        return Response.json(
          { error: 'Invalid callback request' },
          { status: 400 }
        );
      }

      return Response.json(
        { error: 'Failed to process callback' },
        { status: 500 }
      );
    }
  };
}

function workflowMessageHandler(
  workflowCode: string,
  workflowName: string
): MessageHandler<unknown> {
  return async (message_, metadata) => {
    // TODO: validate `message` schema
    const message = message_ as WorkflowInvokePayload;
    console.log('Received workflow message:', message, metadata);

    // Invoke user workflow
    try {
      const result = await runWorkflow(workflowCode, workflowName, message);
      console.log('Workflow result:', result);
      // TODO: update the event log (in database) with the workflow result
    } catch (err_) {
      let err = err_;
      let delay = 0;
      let stepTopic: string | undefined;
      let stepCallbackUrl: URL | undefined;
      const extraState: WorkflowEvent[] = [];

      // The builtin sleep function is special, we just re-invoke the workflow
      // after the specified delay.
      if (
        isInstanceOf(err, StepNotRunError) &&
        err.stepId === '__builtin_sleep'
      ) {
        const msVal = err.args[0] as StringValue;
        if (typeof msVal !== 'string') {
          err = new FatalError(`Invalid argument for sleep step: ${msVal}`);
        }
        delay = Math.floor(ms(msVal) / 1000);
        if (typeof delay !== 'number' || Number.isNaN(delay) || delay < 0) {
          err = new FatalError(`Invalid argument for sleep step: ${msVal}`);
        }
        stepCallbackUrl = new URL(message.callbackUrl);
        stepTopic = `workflow-${workflowName}`;
        extraState.push({
          t: Date.now() + delay * 1000,
          result: null,
        });
      }

      if (isInstanceOf(err, StepNotRunError)) {
        console.log('Step not run:', err.stepId, err.args);
        const stepInvokePayload: StepInvokePayload = {
          ...message,
          stepId: err.stepId,
          arguments: err.args,
        };
        stepInvokePayload.state.push(...extraState);

        const callbackUrl = new URL(message.callbackUrl);

        if (typeof stepTopic === 'undefined') {
          stepTopic = `step-${err.stepId}`;
        }

        if (typeof stepCallbackUrl === 'undefined') {
          stepCallbackUrl = new URL(
            `/api/generated/steps${callbackUrl.search}`,
            callbackUrl
          );
        }

        await send(stepTopic, stepInvokePayload, {
          callback: {
            url: stepCallbackUrl.href,
            delay,
          },
        });
      } else if (isInstanceOf(err, FatalError)) {
        console.error(
          `Workflow failed with a fatal error (Run ID: ${message.runId}): ${err}`
        );
      } else {
        console.error(
          `Unexpected error while running workflow (Run ID: ${message.runId}): ${err}`
        );
      }
    }
  };
}

/**
 * A single route that handles any step execution request and routes to the
 * appropriate step function. We may eventually want to create different bundles
 * for each step, this is temporary.
 */
export async function vercelAPIStepsEntrypoint(
  request: Request
): Promise<Response> {
  try {
    // Parse the queue callback information
    const { queueName, consumerGroup, messageId } =
      parseCallbackRequest(request);

    // Ensure we're handling a `step` topic
    if (!queueName.startsWith('step-')) {
      throw new Error(`Expected 'step-*' topic, got '${queueName}'`);
    }

    // Ensure the consumer group is 'default'
    if (consumerGroup !== 'default') {
      throw new Error(
        `Expected 'default' consumer group, got '${consumerGroup}'`
      );
    }

    // extract the step name from the queue name
    const stepName = queueName.slice('step-'.length);
    const stepFn = getStepFunction(stepName);
    if (!stepFn) {
      throw new Error(`Step ${stepName} not found`);
    }

    // Create client and process the message
    const client = new QueueClient();
    const topic = new Topic(client, queueName);
    const cg = topic.consumerGroup(consumerGroup);

    await cg.consume(stepMessageHandler(stepFn), { messageId });

    return Response.json({ status: 'success' });
  } catch (error) {
    console.error('Callback error:', error);

    if (error instanceof InvalidCallbackError) {
      return Response.json(
        { error: 'Invalid callback request' },
        { status: 400 }
      );
    }

    return Response.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}

function stepMessageHandler(stepFn: StepFunction): MessageHandler<unknown> {
  return async (message_, metadata) => {
    // TODO: validate `message` schema
    const message = message_ as StepInvokePayload;

    console.log('Received step invoke message:', message, metadata);

    let result: unknown;
    try {
      result = await stepFn(...message.arguments);
      console.log('Step result:', result);

      // Update the event log with the step result, and send the
      // updated state payload back to the workflow via the queue
      message.state.push({ t: Date.now(), result });
    } catch (err) {
      console.error(
        `${getErrorName(err)} while running "${message.stepId}" step (Workflow run ID: ${message.runId}): ${String(err)}`
      );
      if (isInstanceOf(err, FatalError)) {
        // Fatal error - store the error in the event log and re-invoke the workflow
        message.state.push({
          t: Date.now(),
          error: String(err),
          stack: err.stack,
          fatal: true,
        });
      } else {
        const deliveryCount = metadata.deliveryCount;
        const maxRetries = stepFn.maxRetries ?? 32;
        if (deliveryCount >= maxRetries) {
          // Max retries reached - store the error in the event log and re-invoke the workflow
          const error = `Max retries reached for step "${message.stepId}" (Workflow run ID: ${message.runId})`;
          message.state.push({
            t: Date.now(),
            error,
            //stack: err.stack,
            fatal: true,
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

    console.log('Sending updated state payload back to the workflow:', message);
    await send(`workflow-${message.workflowId}`, message, {
      callback: {
        url: message.callbackUrl,
        delay: 0,
      },
    });
  };
}

export * from './sleep.js';
