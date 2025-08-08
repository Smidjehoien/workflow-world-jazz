import ms, { type StringValue } from 'ms';
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

export interface RetryableErrorOptions {
  /**
   * The number of seconds to wait before retrying the step.
   * If not provided, the step will be retried after 1 second.
   */
  retryAfter?: number | StringValue | Date;
}

/**
 * An error that can happen during a step execution, allowing
 * for configuration of the retry behavior.
 */
export class RetryableError extends Error {
  /**
   * The Date when the step should be retried.
   */
  retryAfter: Date;

  constructor(message: string, options: RetryableErrorOptions = {}) {
    super(message);
    this.name = 'RetryableError';

    let retryAfterSeconds: number;
    if (typeof options.retryAfter === 'string') {
      retryAfterSeconds = ms(options.retryAfter as StringValue) / 1000;
    } else if (typeof options.retryAfter === 'number') {
      retryAfterSeconds = options.retryAfter;
    } else {
      retryAfterSeconds = 1;
    }
    this.retryAfter = new Date(Date.now() + retryAfterSeconds * 1000);
  }
}

export interface StepInvocationQueueItem {
  type: 'step';
  stepName: string;
  args: Serializable[];
  invocationId: string;
}

export interface WebhookInvocationQueueItem {
  type: 'webhook';
  webhookId: string;
  webhookData: {
    workflow_run_id: string;
    webhook_id: string;
    url?: string;
    allowed_methods?: string[];
    search_params_schema?: Record<string, any>;
    headers_schema?: Record<string, any>;
    body_schema?: Record<string, any>;
  };
}

export type QueueItem = StepInvocationQueueItem | WebhookInvocationQueueItem;

/**
 * An error that is thrown when one or more operations (steps/webhooks) are called but do
 * not yet have corresponding entries in the event log. The workflow
 * dispatcher will catch this error and push the operations
 * onto the queue.
 */
export class StepsNotRunError extends Error {
  steps: QueueItem[];
  globalThis: typeof globalThis;

  constructor(steps: QueueItem[], global: typeof globalThis) {
    const stepCount = steps.filter((s) => s.type === 'step').length;
    const webhookCount = steps.filter((s) => s.type === 'webhook').length;
    const description =
      stepCount > 0 && webhookCount > 0
        ? `${stepCount} steps and ${webhookCount} webhooks have not been run yet`
        : stepCount > 0
          ? `${stepCount} steps have not been run yet`
          : webhookCount > 0
            ? `${webhookCount} webhooks have not been created yet`
            : '0 steps have not been run yet'; // Default case for empty array
    super(description);
    this.name = 'StepsNotRunError';
    this.steps = steps;
    this.globalThis = global;
  }
}

export function ENOTSUP(): never {
  throw new Error('Not supported in workflow functions');
}
