import { STREAM_NAME_SYMBOL } from '../symbols.js';
import { getContext } from './get-context.js';

export function createWorkflowOutputStream<W = any>(): WritableStream<W> {
  const ctx = getContext();
  return Object.create(globalThis.WritableStream.prototype, {
    [STREAM_NAME_SYMBOL]: {
      value: ctx.workflowRunId,
      writable: false,
    },
  });
}
