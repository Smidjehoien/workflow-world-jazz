import type { StepContext } from '../step/get-step-context.js';

export {
  FatalError,
  RetryableError,
  type RetryableErrorOptions,
} from '@vercel/workflow-errors';
export type { Hook, HookOptions } from '../create-hook.js';
export type {
  Webhook,
  WebhookOptions,
} from '../get-webhook.js';
export { createHook } from './create-hook.js';
export { defineHook } from './define-hook.js';
export { getWebhook } from './get-webhook.js';
export { getWorkflowContext } from './get-workflow-context.js';
export { getWorkflowWritableStream } from './writable-stream.js';

// workflows can't use these functions, but we still need to provide
// the export so bundling doesn't fail when step and workflow are in same file
export function getStepContext(): StepContext {
  throw new Error(
    '`getStepContext()` can only be called inside a step function'
  );
}
export function resumeHook() {
  throw new Error(
    '`resumeHook()` can only be called from outside a workflow function'
  );
}
