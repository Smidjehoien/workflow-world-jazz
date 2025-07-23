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

export interface InvocationQueueItem {
  stepName: string;
  args: Serializable[];
  invocationId: string;
}

/**
 * An error that is thrown when one or more steps are called but do
 * not yet have a `step_started` entry in the event log. The workflow
 * dispatcher will catch this error and push the step invocations
 * onto the queue.
 */
export class StepsNotRunError extends Error {
  steps: InvocationQueueItem[];
  globalThis: typeof globalThis;

  constructor(steps: InvocationQueueItem[], global: typeof globalThis) {
    super(`${steps.length} steps have not been run yet`);
    this.name = 'StepsNotRunError';
    this.steps = steps;
    this.globalThis = global;
  }
}

export function ENOTSUP(): never {
  throw new Error('Not supported in workflow functions');
}
