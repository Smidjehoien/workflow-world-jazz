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
