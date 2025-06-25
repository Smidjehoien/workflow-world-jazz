import { runInContext } from 'node:vm';
import { handleCallback, send } from '@vercel/queue';
import { createContext } from '@vercel/workflow-vm';
import { STATE, STEP_INDEX } from './global';
import type { WorkflowInvokePayload } from './schemas';

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
  const initialState = {
    runId,
    callbackUrl: callbackUrl.href,
    state: [{ t: Date.now(), arguments: options.arguments ?? [] }],
  };
  const { messageId } = await send(WORKFLOW_TOPIC, initialState, {
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
        console.log({ result });
        //return Response.json({ result });
      } catch (err) {
        console.log({ err });
        //if (err instanceof Response) return err;
        //return Response.json(
        //  {
        //    error: err instanceof Error ? err.message : String(err),
        //  },
        //  { status: 500 }
        //);
      }
    },
  });
}

export function handleStep() {}
