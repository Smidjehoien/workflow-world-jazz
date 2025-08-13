import { AsyncLocalStorage } from 'node:async_hooks';
import type { WorkflowContext } from '../get-context.js';

export const contextStorage =
  /* @__PURE__ */ new AsyncLocalStorage<WorkflowContext>();

/**
 * This is the step function implementation of `getContext`.
 * It uses `AsyncLocalStorage` to store the context and
 * retrieve it in the step function.
 */
export function getContext(): WorkflowContext {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error(
      '`getContext()` can only be called inside a workflow or step function'
    );
  }
  return ctx;
}
