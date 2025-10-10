export interface PromiseWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

/**
 * Polyfill for `Promise.withResolvers()`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 */
export function withResolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve, reject };
}

/**
 * Creates a lazily-evaluated, memoized version of the provided function.
 *
 * The returned object exposes a `value` getter that calls `fn` only once,
 * caches its result, and returns the cached value on subsequent accesses.
 *
 * @typeParam T - The return type of the provided function.
 * @param fn - The function to be called once and whose result will be cached.
 * @returns An object with a `value` property that returns the memoized result of `fn`.
 */
export function once<T>(fn: () => T) {
  const result = {
    get value() {
      const value = fn();
      Object.defineProperty(result, 'value', { value });
      return value;
    },
  };
  return result;
}

/**
 * Builds a workflow suspension log message based on the counts of steps and webhooks.
 * @param runId - The workflow run ID
 * @param stepCount - Number of steps to be enqueued
 * @param webhookCount - Number of webhooks to be enqueued
 * @returns The formatted log message or null if both counts are 0
 */
export function buildWorkflowSuspensionMessage(
  runId: string,
  stepCount: number,
  webhookCount: number
): string | null {
  if (stepCount === 0 && webhookCount === 0) {
    return null;
  }

  const parts = [];
  if (stepCount > 0) {
    parts.push(`${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`);
  }
  if (webhookCount > 0) {
    parts.push(
      `${webhookCount} ${webhookCount === 1 ? 'webhook' : 'webhooks'}`
    );
  }

  const resumeMsg =
    webhookCount > 0
      ? 'steps are created and webhooks are triggered'
      : 'steps are created';

  return `[Workflows] "${runId}" - ${parts.join(' and ')} to be enqueued\n  Workflow will suspend and resume when ${resumeMsg}`;
}

export function getWorkflowRunStreamId(runId: string, namespace?: string) {
  const streamId = runId.replace('wrun_', 'strm_');
  return namespace ? `${streamId}_${namespace}` : streamId;
}
