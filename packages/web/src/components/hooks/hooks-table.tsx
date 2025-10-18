'use client';

import type { Hook } from '@vercel/workflow-world';
import { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { WorldConfig } from '@/lib/config-world';
import { fetchEventsByCorrelationId } from '@/lib/world';
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
  hasHitLimit?: boolean;
  hasReachedEnd?: boolean;
  onHookClick: (hookId: string) => void;
  selectedHookId?: string;
  onCloseDetailSidebar: () => void;
}

interface InvocationData {
  count: number | Error;
  hasMore: boolean;
  loading: boolean;
}

/**
 * HooksTable - Displays hooks with local pagination.
 * Receives pre-fetched hooks data from parent component.
 * Fetches invocation counts in the background for each hook.
 */
export function HooksTable({
  config,
  hooks,
  loading,
  error,
  initialLoadComplete,
  hasHitLimit = false,
  hasReachedEnd = false,
  onHookClick,
  selectedHookId,
  onCloseDetailSidebar,
}: HooksTableProps) {
  // Track invocation counts per hook (fetched in background)
  const [invocationData, setInvocationData] = useState<
    Map<string, InvocationData>
  >(new Map());

  // Fetch invocation counts for each hook in the background
  useEffect(() => {
    if (!hooks.length) return;

    const fetchInvocations = async () => {
      // Initialize all hooks as loading
      const initialData = new Map<string, InvocationData>();
      for (const hook of hooks) {
        initialData.set(hook.hookId, {
          count: 0,
          hasMore: false,
          loading: true,
        });
      }
      setInvocationData(initialData);

      // Fetch events for each hook
      const results = await Promise.allSettled(
        hooks.map(async (hook) => {
          try {
            const events = await fetchEventsByCorrelationId(
              config,
              hook.hookId,
              undefined,
              'asc',
              100
            );

            // Count only hook_received events
            const count = events.data.filter(
              (e) => e.eventType === 'hook_received'
            ).length;

            return {
              hookId: hook.hookId,
              count,
              hasMore: events.hasMore,
            };
          } catch (e) {
            return {
              hookId: hook.hookId,
              count: e as Error,
              hasMore: false,
            };
          }
        })
      );

      // Update state with results
      setInvocationData((prev) => {
        const updated = new Map(prev);
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const hookId = hooks[i].hookId;
          if (result.status === 'fulfilled') {
            updated.set(result.value.hookId, {
              count: result.value.count,
              hasMore: result.value.hasMore,
              loading: false,
            });
          } else {
            // Mark the failed hook as not loading with default values
            updated.set(hookId, { count: 0, hasMore: false, loading: false });
          }
        }
        return updated;
      });
    };

    fetchInvocations();
  }, [hooks, config]);

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
      key: 'token',
      header: 'Token',
      render: (hook) => (
        <span className="font-mono text-xs">
          {hook.token.substring(0, 12)}...
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (hook) =>
        hook.createdAt ? <RelativeTime date={hook.createdAt} /> : '-',
    },
    {
      key: 'invocations',
      header: 'Invocations',
      render: (hook) => {
        const data = invocationData.get(hook.hookId);

        if (!data || data.loading) {
          return <span className="text-muted-foreground text-xs">...</span>;
        }

        if (data.count instanceof Error) {
          return <span className="text-muted-foreground">Error</span>;
        }

        if (data.count === 0) {
          return <span className="text-muted-foreground">0</span>;
        }

        const displayText = data.hasMore ? `${data.count}+` : `${data.count}`;

        if (data.hasMore) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-semibold cursor-help">{displayText}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  Showing first 100 invocations. There may be more.
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        return <span className="font-semibold">{displayText}</span>;
      },
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
        hasHitLimit={hasHitLimit}
        hasReachedEnd={hasReachedEnd}
      />
    </>
  );
}
