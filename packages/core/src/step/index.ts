import type { WorkflowContext } from '../workflow/get-workflow-context.js';

export {
  getWebhook,
  type Webhook,
  type WebhookOptions,
} from '../get-webhook.js';
export {
  FatalError,
  RetryableError,
  type RetryableErrorOptions,
} from '../global.js';
export { sleep } from '../sleep.js';
export { getWorkflowWritableStream } from '../writable-stream.js';
export { getStepContext } from './get-step-context.js';

// steps can't use `getWorkflowContext` but we still need to provide
// the export so bundling doesn't fail when step and workflow are in same file
export function getWorkflowContext(): WorkflowContext {
  throw new Error(
    '`getWorkflowContext()` can only be called inside a workflow or step function'
  );
}
