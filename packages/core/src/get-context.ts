export interface WorkflowContext {
  /**
   * Unique identifier for the workflow run.
   */
  workflowRunId: string;

  /**
   * Timestamp when the workflow run started.
   */
  workflowStartedAt: Date;

  /**
   * The URL where the workflow can be triggered.
   */
  url: string;
}

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

export { getStepContext } from './step/get-step-context.js';
export { getWorkflowContext } from './workflow/get-workflow-context.js';
