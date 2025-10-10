import type { getWorkflowReadableStream } from './runtime/readable-stream.js';

/**
 * The options for {@link getWorkflowWritableStream}.
 */
export interface WorkflowWritableStreamOptions {
  /**
   * An optional namespace to distinguish between multiple streams associated
   * with the same workflow run.
   */
  namespace?: string;
}

/**
 * Retrieves a writable stream that is associated with the current workflow.
 *
 * The writable stream is intended to be passed as an argument to steps which can
 * write to it. Chunks written to this stream can be read outside the workflow
 * by using {@link getWorkflowReadableStream}.
 *
 * @note This function can only be called inside a workflow function.
 * @returns The writable stream.
 */
export function getWorkflowWritableStream<W = any>(
  // @ts-expect-error `options` is here for types/docs
  options: WorkflowWritableStreamOptions = {}
): WritableStream<W> {
  throw new Error(
    '`getWorkflowWritableStream()` can only be called inside a workflow function'
  );
}
