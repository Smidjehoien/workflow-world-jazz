import { getContext, useWebhook } from '@vercel/workflow-core';

/**
 * `getContext()` is a hook that allows you to access the context
 * of the current workflow run.
 *
 * It is useful for accessing the context of the current workflow run, such as
 * the workflow run ID, the workflow started at, and the attempt number.
 */
async function stepWithGetContext() {
  'use step';
  const ctx = getContext();
  console.log('step context', ctx);

  // Mimic a retryable error 50% of the time (so that the `attempt` counter increases)
  if (Math.random() < 0.5) {
    throw new Error('Retryable error');
  }
}

export async function withGetContext() {
  'use workflow';
  const ctx = getContext();
  console.log('workflow context', ctx);

  await stepWithGetContext();
}

/**
 * `useWebhook()` is a hook that allows you to register a webhook URL
 * that can be passed to external services as a callback URL, or used
 * for human-in-the-loop workflows by, for example, including in an email.
 *
 * The workflow run will be suspended until the webhook is called.
 *
 * NOTE: Your project **must** have an environment variable named
 * `WORKFLOW_WEBHOOK_SECRET` set to a random string when using webhooks.
 */
export async function withUseWebhook() {
  'use workflow';
  const webhook = useWebhook({
    method: ['POST', 'GET', 'DELETE'],
  });
  console.log('Registered webhook:', webhook.url);

  for await (const req of webhook) {
    console.log('Received webhook request:', req);

    const text = await req.text();
    console.log('Webhook request text:', text);

    if (req.method === 'DELETE') {
      break;
    }
  }

  console.log('Webhook completed');
}
