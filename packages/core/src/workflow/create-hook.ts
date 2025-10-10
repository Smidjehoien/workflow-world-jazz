import type {
  Hook,
  HookOptions,
  Webhook,
  WebhookOptions,
} from '../create-hook.js';
import { WORKFLOW_CREATE_HOOK } from '../symbols.js';
import { getWorkflowMetadata } from './get-workflow-metadata.js';

export function createHook<T = any>(options?: HookOptions): Hook<T> {
  // Inside the workflow VM, the hook function is stored in the globalThis object behind a symbol
  const createHookFn = (globalThis as any)[
    WORKFLOW_CREATE_HOOK
  ] as typeof createHook<T>;
  if (!createHookFn) {
    throw new Error(
      '`createHook()` can only be called inside a workflow function'
    );
  }
  return createHookFn(options);
}

export function createWebhook(options?: WebhookOptions): Webhook {
  const { url } = getWorkflowMetadata();
  const hook = createHook(options) as Webhook;
  hook.url = `${url}/.well-known/workflow/v1/webhook/${encodeURIComponent(hook.token)}`;
  return hook;
}
