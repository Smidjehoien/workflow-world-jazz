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
   * Unique identifier for the currently executing step.
   * Useful to use as part of an idempotency key for critical
   * operations that must only be executed once (such as charging a customer).
   *
   * **Note:** Only available inside a step function.
   * Accessing this property in a workflow function will throw an error.
   */
  stepId: string;

  /**
   * The number of times the current step has been executed.
   * Will increase with each retry.
   *
   * **Note:** Only available inside a step function.
   * Accessing this property in a workflow function will throw an error.
   */
  attempt: number;

  /**
   * The URL where the workflow can be triggered.
   */
  url: string;
}

export function useContext(): WorkflowContext {
  throw new Error(
    '`useContext()` can only be called inside a workflow or step function'
  );
}
