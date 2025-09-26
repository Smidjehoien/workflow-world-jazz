import { hydrateStepReturnValue } from '@vercel/workflow-core/serialization';
import type { InspectCLIOptions } from '../config/types.js';

/**
 * Converts hydrated values to string format for CLI stream output
 */
const formatHydratedValue = (hydratedValue: any): string => {
  if (typeof hydratedValue === 'string') {
    return hydratedValue;
  } else if (hydratedValue instanceof Uint8Array) {
    // Uint8Array is Buffer-compatible
    return Buffer.from(hydratedValue).toString('utf8');
  } else if (hydratedValue instanceof ArrayBuffer) {
    // ArrayBuffer needs to be converted to Uint8Array first
    return Buffer.from(new Uint8Array(hydratedValue)).toString('utf8');
  } else if (hydratedValue === null || hydratedValue === undefined) {
    return String(hydratedValue);
  } else {
    // objects, arrays, and other types stay as is
    return hydratedValue;
  }
};

/**
 * Processes a single chunk from the stream for CLI stream output
 */
const processChunk = (
  value: Uint8Array,
  id: string,
  opts: InspectCLIOptions
): { success: boolean; outputValue?: string } => {
  try {
    const strValue = Buffer.from(value).toString('utf8');
    const jsonValue = JSON.parse(strValue);
    // TODO: Instead of hydrating individual chunks, world.readFromStream()
    // should return a stream with every chunk already hydrated. Also,
    // WorkflowServerReadableStream should not use the world interface internally
    // to get the read stream.
    const hydratedValue = hydrateStepReturnValue(jsonValue);
    const outputValue = formatHydratedValue(hydratedValue);

    return { success: true, outputValue };
  } catch (parseErr) {
    // Handle malformed chunks gracefully - log but continue reading
    console.warn(`Warning: Failed to parse chunk from stream ${id}:`, parseErr);
    if (opts.json) {
      const warningJson = JSON.stringify({
        warning: `Failed to parse chunk from stream ${id}`,
        details: String(parseErr),
        rawChunk: Buffer.from(value).toString('utf8'),
      });
      process.stderr.write(`${warningJson}\n`);
    }
    return { success: false };
  }
};

/**
 * This function will read from the stream and write the output to the console.
 * If the stream is not closed, this function will block until the stream is closed.
 */
export const streamToConsole = async (
  stream: ReadableStream,
  id: string,
  opts: InspectCLIOptions
) => {
  const reader = stream.getReader();
  // Keep the Node.js event loop alive while we await stream closure.
  // Pending Promises alone do not keep the process alive when using oclif.
  const keepAlive = setInterval(() => {}, 60_000);
  try {
    for (;;) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      // Skip empty chunks - this prevents crashes when value is undefined/null
      // but done is false (stream waiting for more data)
      if (!value || value.byteLength === 0) {
        continue;
      }

      const result = processChunk(value, id, opts);
      if (result.success && result.outputValue !== undefined) {
        process.stdout.write(`${JSON.stringify(result.outputValue)}\n`);
      }
    }
  } catch (err) {
    console.error(`Failed to read stream with ID ${id}:`, err);
    if (opts.json) {
      const json = JSON.stringify({
        error: `Failed to read stream with ID ${id}`,
        details: String(err),
      });
      process.stderr.write(`${json}\n`);
    }
  } finally {
    clearInterval(keepAlive);
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation errors during cleanup
    }
  }
};
