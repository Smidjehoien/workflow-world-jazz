import { handleCallback, send } from '@vercel/queue';

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
  if (!options.baseUrl) {
    const vercelUrl = process.env.VERCEL_URL;
    if (!vercelUrl) {
      throw new Error('The `baseUrl` option must be provided');
    }
    baseUrl = `https://${vercelUrl}`;
  }
  const callbackUrl = new URL(`/api/workflows/${workflowId}`, baseUrl).href;
  const runId = crypto.randomUUID();
  const initialState = {
    runId,
    callbackUrl,
    state: [[{ t: Date.now(), arguments: options.arguments ?? [] }]],
  };
  await send(WORKFLOW_TOPIC, initialState, {
    callback: {
      url: callbackUrl,
    },
  });
  return runId;
}

// ---------------------------------------------------------

export function handleWorkflow() {
  return handleCallback({
    [WORKFLOW_TOPIC]: (message, metadata) => {
      console.log('Received workflow message:', message, metadata);
    },
  });
}
