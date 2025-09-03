export class WorkflowRunNotCompletedError extends Error {
  runId: string;
  status: string;

  constructor(runId: string, status: string) {
    super(`Workflow run "${runId}" has not completed`);
    this.name = 'WorkflowRunNotCompletedError';
    this.runId = runId;
    this.status = status;
  }
}

export class WorkflowRunFailedError extends Error {
  runId: string;
  error: string;

  constructor(runId: string, error: string) {
    super(`Workflow run "${runId}" failed: ${error}`);
    this.name = 'WorkflowRunFailedError';
    this.runId = runId;
    this.error = error;
  }
}

export class WorkflowAPIError extends Error {
  status?: number;
  code?: string;
  url?: string;
  readonly cause?: unknown;

  constructor(
    message: string,
    {
      status,
      code,
      url,
      cause,
    }: { status?: number; url?: string; code?: string; cause?: unknown }
  ) {
    super(message, { cause });
    this.name = 'WorkflowAPIError';
    this.status = status;
    this.code = code;
    this.url = url;

    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  /**
   * Type guard to check if an error is a WorkflowAPIError.
   */
  static is(error: any): error is WorkflowAPIError {
    return error instanceof WorkflowAPIError;
  }
}

export class WorkflowRuntimeError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'WorkflowRuntimeError';
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}
