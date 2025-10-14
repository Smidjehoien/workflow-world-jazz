import { STREAM_NAME_SYMBOL } from '../symbols.js';
import { getWorkflowRunStreamId } from '../util.js';
import type { WorkflowWritableStreamOptions } from '../writable-stream.js';
import { getWorkflowMetadata } from './get-workflow-metadata.js';

export function getWritable<W = any>(
  options: WorkflowWritableStreamOptions = {}
): WritableStream<W> {
  const ctx = getWorkflowMetadata();
  const { namespace } = options;
  const name = getWorkflowRunStreamId(ctx.workflowRunId, namespace);
  return Object.create(globalThis.WritableStream.prototype, {
    [STREAM_NAME_SYMBOL]: {
      value: name,
      writable: false,
    },
  });
}
