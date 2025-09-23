import { AsyncLocalStorage } from 'node:async_hooks';
import type { StepContext } from '../get-context.js';

export const contextStorage =
  /* @__PURE__ */ new AsyncLocalStorage<StepContext>();

/**
 * Returns additional metadata available in the current step function.
 * It uses `AsyncLocalStorage` to store the context and
 * retrieve it in the step function.
 */
export function getStepContext(): StepContext {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error(
      '`getStepContext()` can only be called inside a step function'
    );
  }
  return ctx;
}
