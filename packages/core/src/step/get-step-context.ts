import { AsyncLocalStorage } from 'node:async_hooks';
import type { WorkflowContext } from '../workflow/get-workflow-context.js';

export interface StepContext extends WorkflowContext {
  /**
   * Unique identifier for the currently executing step.
   * Useful to use as part of an idempotency key for critical
   * operations that must only be executed once (such as charging a customer).
   *
   * **Note:** Only available inside a step function.
   * Accessing this property in a workflow function will throw an error.
   */
  stepId: string;

  /**
   * Timestamp when the current step started.
   *
   * **Note:** Only available inside a step function.
   * Accessing this property in a workflow function will throw an error.
   */
  stepStartedAt: Date;

  /**
   * The number of times the current step has been executed.
   * Will increase with each retry.
   *
   * **Note:** Only available inside a step function.
   * Accessing this property in a workflow function will throw an error.
   */
  attempt: number;
}

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
