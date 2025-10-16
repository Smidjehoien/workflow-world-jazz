'use client';

import type { Hook } from '@vercel/workflow-world';
import { createAPICallKey } from '@/hooks/use-api';
import { useExhaustiveList } from '@/hooks/use-exhaustive-list';
import type { WorldConfig } from '@/lib/config-world';
import { fetchHooks } from '@/lib/world';
import { HooksTable } from './hooks-table';

interface HooksTableWithDataProps {
  config: WorldConfig;
  runId?: string;
  onHookClick: (hookId: string) => void;
  selectedHookId?: string;
  onCloseDetailSidebar: () => void;
}

/**
 * HooksTableWithData - Fetches and displays hooks with local pagination.
 * Handles data fetching for standalone usage (e.g., on the main dashboard).
 */
export function HooksTableWithData({
  config,
  runId,
  onHookClick,
  selectedHookId,
  onCloseDetailSidebar,
}: HooksTableWithDataProps) {
  // Fetch data
  const {
    items: hooks,
    loading,
    error,
    initialLoadComplete,
  } = useExhaustiveList<Hook, { config: WorldConfig; runId?: string }>({
    createKey: (params, cursor) =>
      createAPICallKey(
        params.config,
        'hooks-exhaustive',
        params.runId || 'all',
        cursor,
        'asc'
      ),
    fetcher: async (params, cursor, sortOrder, limit) => {
      return fetchHooks(params.config, params.runId, cursor, sortOrder, limit);
    },
    params: { config, runId },
    live: false,
  });

  return (
    <HooksTable
      config={config}
      runId={runId}
      hooks={hooks}
      loading={loading}
      error={error || undefined}
      initialLoadComplete={initialLoadComplete}
      onHookClick={onHookClick}
      selectedHookId={selectedHookId}
      onCloseDetailSidebar={onCloseDetailSidebar}
    />
  );
}
