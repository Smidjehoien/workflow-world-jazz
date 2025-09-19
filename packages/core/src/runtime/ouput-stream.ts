import { getExternalRevivers } from '../serialization.js';

/**
 * The options for {@link getWorkflowOutputStream}.
 */
export interface WorkflowOutputStreamOptions {
  /**
   * The index number of the starting chunk to beging reading the stream from.
   */
  startIndex?: number;
  /**
   * Any asynchronous operations that need to be performed before the execution
   * environment is paused / terminated
   * (i.e. using [`waitUntil()`](https://developer.mozilla.org/docs/Web/API/ExtendableEvent/waitUntil) or similar).
   */
  ops?: Promise<any>[];
  /**
   * The global object to use for hydrating types from the global scope.
   *
   * Defaults to {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/globalThis | `globalThis`}.
   */
  global?: Record<string, any>;
}

/**
 * Retrieves the output readable stream for a workflow run for external consumers.
 *
 * @param runId - The workflow run ID.
 * @param options - The options for the output stream.
 * @returns The `ReadableStream` for the workflow run.
 */
export function getWorkflowOutputStream<R = any>(
  runId: string,
  {
    ops = [],
    global = globalThis,
    startIndex,
  }: WorkflowOutputStreamOptions = {}
) {
  return getExternalRevivers(global, ops).ReadableStream({
    name: runId,
    startIndex,
  }) as ReadableStream<R>;
}
