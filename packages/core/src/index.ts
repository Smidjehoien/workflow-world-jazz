import { runInContext } from 'node:vm';
import { handleCallback, send } from '@vercel/queue';
import { createContext } from '@vercel/workflow-vm';
import { FatalError, STATE, STEP_INDEX, StepNotRunError } from './global';
import type { StepInvokePayload, WorkflowInvokePayload } from './schemas';
import { getErrorName, isError } from './types';

const WORKFLOW_TOPIC = 'workflow';

export interface StartOptions {
  arguments?: unknown[];
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
  let baseUrl = options.baseUrl;

  // Infer the base URL from the VERCEL_URL environment variable
  // when no `baseUrl` option is provided.
  if (!options.baseUrl) {
    const vercelUrl = process.env.VERCEL_URL;
    if (!vercelUrl) {
      throw new Error('The `baseUrl` option must be provided');
    }
    baseUrl = `https://${vercelUrl}`;
  }

  const callbackUrl = new URL(`/api/workflows/${workflowId}`, baseUrl);

  // Add the protection bypass token to the callback URL
  // when the `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable is set
  // and the `baseUrl` option is not provided.
  if (!options.baseUrl) {
    const vercelAutomationBypassSecret =
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (vercelAutomationBypassSecret) {
      callbackUrl.searchParams.set(
        'x-vercel-protection-bypass',
        vercelAutomationBypassSecret
      );
    }
  }

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
        if (isError(StepNotRunError, err)) {
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
        } else if (isError(FatalError, err)) {
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

export function handleStep(stepFn: (...args: any[]) => Promise<unknown>) {
  return handleCallback({
    async [WORKFLOW_TOPIC](message_, metadata) {
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
        if (isError(FatalError, err)) {
          // Fatal error - store the error in the event log and re-invoke the workflow
          message.state.push({
            t: Date.now(),
            error: String(err),
            stack: err.stack,
            fatal: true,
          });
        } else {
          // it's a retryable error - so have the queue keep the message visible so that it gets retried
          // TODO: respect the retry count… backoff configuration… etc.
          return {
            timeoutSeconds: 1,
          };
        }
      }

      console.log(
        'Sending updated state payload back to the workflow:',
        message
      );
      await send(WORKFLOW_TOPIC, message, {
        callback: {
          url: message.callbackUrl,
        },
      });
    },
  });
}

export * from './step';
