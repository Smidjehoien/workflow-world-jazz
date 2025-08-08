import type { Webhook, WebhookOptions } from '../get-webhook.js';

export const WORKFLOW_GET_WEBHOOK_SYMBOL = /* @__PURE__ */ Symbol.for(
  'WORKFLOW_GET_WEBHOOK'
);

export function getWebhook(options?: WebhookOptions): Webhook {
  return (globalThis as any)[WORKFLOW_GET_WEBHOOK_SYMBOL](options) as Webhook;
}
