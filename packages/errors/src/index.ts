const BASE_URL = 'https://workflow-docs.vercel.sh/errors';

/**
 * All the slugs of the errors.
 */
export const ERROR_SLUGS = {
  START_INVALID_WORKFLOW_FUNCTION: 'start-invalid-workflow-function',
  SERIALIZATION_FAILED: 'serialization-failed',
  WORKFLOW_API_ERROR: 'workflow-api-error',
  WORKFLOW_RUN_FAILED_ERROR: 'workflow-run-failed-error',
  WORKFLOW_RUN_NOT_COMPLETED_ERROR: 'workflow-run-not-completed-error',
  WORKFLOW_RUNTIME_ERROR: 'workflow-runtime-error',
} as const;

type ErrorSlug = (typeof ERROR_SLUGS)[keyof typeof ERROR_SLUGS];

interface WorkflowErrorOptions {
  /**
   * The cause of the error.
   */
  cause?: unknown;
  /**
   * The slug of the error. This will be used to generate a link to the error documentation.
   */
  slug?: ErrorSlug;
}

/**
 * The base class for all Workflow-related errors.
 */
export class WorkflowError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: WorkflowErrorOptions) {
    const msgDocs = options?.slug
      ? `${message}\n\nLearn more: ${BASE_URL}/${options.slug}`
      : message;
    super(msgDocs, { cause: options?.cause });
    this.cause = options?.cause;

    if (options?.cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

export class WorkflowAPIError extends WorkflowError {
  status?: number;
  code?: string;
  url?: string;

  constructor(
    message: string,
    options?: { status?: number; url?: string; code?: string; cause?: unknown }
  ) {
    super(message, {
      slug: ERROR_SLUGS.WORKFLOW_API_ERROR,
      cause: options?.cause,
    });
    this.name = 'WorkflowAPIError';
    this.status = options?.status;
    this.code = options?.code;
    this.url = options?.url;
  }
}

export class WorkflowRunFailedError extends WorkflowError {
  runId: string;
  error: string;

  constructor(runId: string, error: string) {
    super(`Workflow run "${runId}" failed: ${error}`, {
      slug: ERROR_SLUGS.WORKFLOW_RUN_FAILED_ERROR,
    });
    this.name = 'WorkflowRunFailedError';
    this.runId = runId;
    this.error = error;
  }
}

export class WorkflowRunNotCompletedError extends WorkflowError {
  runId: string;
  status: string;

  constructor(runId: string, status: string) {
    super(`Workflow run "${runId}" has not completed`, {
      slug: ERROR_SLUGS.WORKFLOW_RUN_NOT_COMPLETED_ERROR,
    });
    this.name = 'WorkflowRunNotCompletedError';
    this.runId = runId;
    this.status = status;
  }
}

export class WorkflowRuntimeError extends WorkflowError {
  constructor(message: string, options?: WorkflowErrorOptions) {
    super(message, {
      ...options,
    });
    this.name = 'WorkflowRuntimeError';
  }
}
