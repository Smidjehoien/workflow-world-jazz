import type { Serializable } from './schemas.js';

/**
 * A fatal error is an error that cannot be retried.
 * It will cause the step to fail and the error will
 * be bubbled up to the workflow logic.
 */
export class FatalError extends Error {
  fatal = true;

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
  stepName: string;
  args: Serializable[];

  constructor(stepName: string, args: Serializable[]) {
    super(
      `Step ${stepName} has not been run yet. Arguments: ${JSON.stringify(args)}`
    );
    this.name = 'StepNotRunError';
    this.stepName = stepName;
    this.args = args;
  }
}
