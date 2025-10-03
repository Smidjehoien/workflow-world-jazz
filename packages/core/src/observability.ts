/**
 * Observability utilities for workflow inspection.
 * Shared between CLI and Web UI for consistent behavior.
 */

/**
 * Check if a value is a stream ID
 */
export function isStreamId(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('strm_');
}

/**
 * Extract all stream IDs from a value (recursively traverses objects/arrays)
 */
export function extractStreamIds(obj: unknown): string[] {
  const streamIds: string[] = [];

  function traverse(value: unknown): void {
    if (isStreamId(value)) {
      streamIds.push(value as string);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        traverse(item);
      }
    } else if (value && typeof value === 'object') {
      for (const val of Object.values(value)) {
        traverse(val);
      }
    }
  }

  traverse(obj);
  return Array.from(new Set(streamIds)); // Remove duplicates
}

/**
 * Extract streams from a value and collect them with their source information
 * Used for building lists of streams with context about where they came from
 */
export function extractStreamsFromValue(
  value: unknown,
  source: string,
  streams: Array<{ streamId: string; source: string }>
): void {
  if (isStreamId(value)) {
    streams.push({ streamId: value as string, source });
  } else if (Array.isArray(value)) {
    for (const item of value) {
      extractStreamsFromValue(item, source, streams);
    }
  } else if (value && typeof value === 'object') {
    for (const val of Object.values(value)) {
      extractStreamsFromValue(val, source, streams);
    }
  }
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
export function truncateId(id: string, maxLength = 12): string {
  if (id.length <= maxLength) return id;
  return `${id.slice(0, maxLength)}...`;
}
