import {
  extractStreamIds,
  isStreamId,
} from '@vercel/workflow-core/observability';

// Re-export for convenience
export { isStreamId, extractStreamIds };

// Format value for display, replacing stream IDs with clickable links
export function formatValueWithStreams(
  value: unknown,
  onStreamClick?: (streamId: string) => void
): React.ReactNode {
  if (isStreamId(value)) {
    const streamId = value as string;
    if (onStreamClick) {
      return (
        <button
          type="button"
          onClick={() => onStreamClick(streamId)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-mono text-sm"
        >
          {streamId}
        </button>
      );
    }
    return <span className="font-mono text-sm text-green-600">{streamId}</span>;
  }

  if (value === null)
    return <span className="text-muted-foreground">null</span>;
  if (value === undefined)
    return <span className="text-muted-foreground">undefined</span>;

  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  // For complex objects, show JSON with stream IDs highlighted
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
