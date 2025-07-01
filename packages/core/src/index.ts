import { runInContext } from 'node:vm';
import { handleCallback, type MessageMetadata, send } from '@vercel/queue';
import { createContext } from '@vercel/workflow-vm';
import { getBaseUrl } from './base-url';
import { FatalError, STATE, STEP_INDEX, StepNotRunError } from './global';
import type { StepInvokePayload, WorkflowInvokePayload } from './schemas';
import { getErrorName, isInstanceOf } from './types';

export { FatalError, StepNotRunError } from './global';

export const WORKFLOW_TOPIC = 'workflow';

export interface StartOptions {
  arguments?: unknown[];
  baseUrl?: string;
}

export type StepFunction<
  Args extends Serializable[] = any[],
  Result extends Serializable | unknown = unknown,
> = (...args: Args) => Promise<Result>;

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
    `/api/workflows/${workflowId}${baseUrl.search}`,
    baseUrl
  );

  const runId = crypto.randomUUID();
  const payload: WorkflowInvokePayload = {
    runId,
    callbackUrl: callbackUrl.href,
    state: [{ t: Date.now(), arguments: options.arguments ?? [] }],
  };
  const { messageId } = await send(WORKFLOW_TOPIC, payload, {
    callback: {
      url: callbackUrl.href,
    },
  });
  console.log('Sent workflow message:', messageId);
  return { runId };
}

// ---------------------------------------------------------

export function handleWorkflow(workflowCode: string, workflowName: string) {
  return handleCallback({
    async [WORKFLOW_TOPIC](message_, metadata) {
      // TODO: validate `message` schema
      const message = message_ as WorkflowInvokePayload;
      const initialState = message.state[0];

      console.log('Received workflow message:', message, metadata);

      const context = createContext({
        seed: message.runId,
        fixedTimestamp: initialState.t,
      });

      // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
      context[STATE] = message.state;
      // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
      context[STEP_INDEX] = 1;

      // Invoke user workflow
      try {
        const workflowFn = runInContext(
          `${workflowCode};${workflowName}`,
          context
        );
        if (typeof workflowFn !== 'function') {
          throw new Error('Workflow code must be a function');
        }
        const result = await workflowFn(...initialState.arguments);
        console.log('Workflow result:', result);
      } catch (err) {
        if (isInstanceOf(err, StepNotRunError)) {
          console.log('Step not run:', err.stepId, err.args);
          const stepInvokePayload: StepInvokePayload = {
            runId: message.runId,
            callbackUrl: message.callbackUrl,
            state: message.state,
            stepId: err.stepId,
            arguments: err.args as unknown[],
          };
          const callbackUrl = new URL(message.callbackUrl);
          const stepCallbackUrl = new URL(
            `/api/steps/${err.stepId}${callbackUrl.search}`,
            callbackUrl
          );
          await send(WORKFLOW_TOPIC, stepInvokePayload, {
            callback: {
              url: stepCallbackUrl.href,
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
    },
  });
}

/** @deprecated Single step route handler */
export function handleStep(stepFn: StepFunction) {
  return handleCallback({
    async [WORKFLOW_TOPIC](message_, metadata) {
      return _handleStep(stepFn)(message_, metadata);
    },
  });
}

export function _handleStep(stepFn: StepFunction) {
  return async (message_: unknown, metadata: MessageMetadata) => {
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
        // @ts-expect-error - quick hack
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
    await send(WORKFLOW_TOPIC, message, {
      callback: {
        url: message.callbackUrl,
      },
    });
  };
}

/**
 * A serializable value:
 *  Any valid JSON object is serializable
 *
 * @example ```ts
 * // any valid JSON object is serializable
 * const anyJson: Serializable = { foo: "bar" };
 *
 * ```
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };
// TODO: add support for binary data and streams using vqs
// | ArrayBuffer; // TODO:

export * from './step';
