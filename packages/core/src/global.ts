/**
 * Global state that is shared between the workflow wrapper
 * and the step stub functions.
 */
export const STATE = Symbol('STATE');

/**
 * The index of the current step of the running workflow.
 */
export const STEP_INDEX = Symbol('STEP_INDEX');

/**
 * A fatal error is an error that cannot be retried.
 * It will cause the step to fail and the error will
 * be bubbled up to the workflow logic.
 */
export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}
