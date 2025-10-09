import { STREAM_NAME_SYMBOL } from '../symbols.js';
import { getWorkflowMetadata } from './get-workflow-metadata.js';

export function getWorkflowWritableStream<W = any>(): WritableStream<W> {
  const ctx = getWorkflowMetadata();
  return Object.create(globalThis.WritableStream.prototype, {
    [STREAM_NAME_SYMBOL]: {
      value: ctx.workflowRunId,
      writable: false,
    },
  });
}
