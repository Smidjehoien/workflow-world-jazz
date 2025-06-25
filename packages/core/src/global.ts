/**
 * Global state that is shared between the workflow wrapper
 * and the step stub functions.
 */
export const STATE = Symbol.for('STATE');

/**
 * The index of the current step of the running workflow.
 */
export const STEP_INDEX = Symbol.for('STEP_INDEX');

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

/**
 * An error that is thrown when a step is called but does
 * not yet have a result entry in the event log. The workflow
 * dispatcher will catch this error and push the step invocation
 * onto the queue.
 */
export class StepNotRunError extends Error {
  stepId: string;
  args: unknown[];

  constructor(stepId: string, args: unknown[]) {
    super(
      `Step ${stepId} has not been run yet. Arguments: ${JSON.stringify(args)}`
    );
    this.name = 'StepNotRunError';
    this.stepId = stepId;
    this.args = args;
  }
}
