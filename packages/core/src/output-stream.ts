/**
 * Retrieves the output writable stream associated with the current workflow run.
 *
 * The writable stream is intented to be passed as an argument to other steps.
 *
 * @note This function can only be called inside a workflow function.
 * @returns The writable stream.
 */
export function createWorkflowOutputStream<W = any>(): WritableStream<W> {
  throw new Error(
    '`createWorkflowOutputStream()` can only be called inside a workflow function'
  );
}
