import type { Webhook, WebhookOptions } from '../use-webhook.js';

export const WORKFLOW_USE_WEBHOOK_SYMBOL = /* @__PURE__ */ Symbol.for(
  'WORKFLOW_USE_WEBHOOK'
);

export function useWebhook(options: WebhookOptions): Webhook {
  return (globalThis as any)[WORKFLOW_USE_WEBHOOK_SYMBOL](options) as Webhook;
}
