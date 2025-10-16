'use client';

import type { Hook } from '@vercel/workflow-world';
import type { WorldConfig } from '@/lib/config-world';
import type { ColumnDefinition } from '../display-utils/local-paginating-table';
import { LocalPaginatingTable } from '../display-utils/local-paginating-table';
import { RelativeTime } from '../display-utils/relative-time';
import { HookDetailSidebar } from './hook-detail-sidebar';

interface HooksTableProps {
  config: WorldConfig;
  runId?: string;
  // Required: pre-fetched hooks data from parent component
  hooks: Hook[];
  loading: boolean;
  error?: Error;
  initialLoadComplete: boolean;
  onHookClick: (hookId: string) => void;
  selectedHookId?: string;
  onCloseDetailSidebar: () => void;
}

/**
 * HooksTable - Displays hooks with local pagination.
 * Receives pre-fetched hooks data from parent component.
 */
export function HooksTable({
  config,
  hooks,
  loading,
  error,
  initialLoadComplete,
  onHookClick,
  selectedHookId,
  onCloseDetailSidebar,
}: HooksTableProps) {
  // Define table columns
  const columns: ColumnDefinition<Hook>[] = [
    {
      key: 'hookId',
      header: 'Hook ID',
      render: (hook) => (
        <span className="font-mono text-xs">{hook.hookId}</span>
      ),
    },
    {
      key: 'runId',
      header: 'Run ID',
      render: (hook) => <span className="font-mono text-xs">{hook.runId}</span>,
    },
    {
      key: 'ownerId',
      header: 'Owner ID',
      render: (hook) => (
        <span className="font-mono text-xs">{hook.ownerId}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (hook) =>
        hook.createdAt ? <RelativeTime date={hook.createdAt} /> : '-',
    },
    {
      key: 'response',
      header: 'Has Response',
      render: (hook) =>
        (hook as any).response !== undefined ? (
          <span className="text-green-600 dark:text-green-400">✓</span>
        ) : (
          <span className="text-gray-400">–</span>
        ),
    },
  ];

  return (
    <>
      {selectedHookId && (
        <HookDetailSidebar
          config={config}
          hookId={selectedHookId}
          onClose={onCloseDetailSidebar}
        />
      )}
      <LocalPaginatingTable
        items={hooks}
        columns={columns}
        title="Hooks"
        loading={loading && !initialLoadComplete}
        error={error}
        getItemKey={(hook) => hook.hookId}
        onRowClick={(hook) => onHookClick(hook.hookId)}
        isRowSelected={(hook) => hook.hookId === selectedHookId}
        emptyMessage="No hooks found"
      />
    </>
  );
}
