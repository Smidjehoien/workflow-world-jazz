'use client';

import type { Event } from '@vercel/workflow-world';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useHook } from '@/hooks/use-api';
import type { WorldConfig } from '@/lib/config-world';
import { fetchEvents, fetchHook } from '@/lib/world';
import { JsonView } from '../display-utils/json-view';
import { RelativeTime } from '../display-utils/relative-time';
import { SidePanel } from '../display-utils/side-panel';

interface HookDetailSidebarProps {
  config: WorldConfig;
  hookId: string;
  onClose: () => void;
}

export function HookDetailSidebar({
  config,
  hookId,
  onClose,
}: HookDetailSidebarProps) {
  // First fetch the hook to get the runId
  const {
    data: initialHook,
    error: initialError,
    isLoading: initialLoading,
  } = useHook(config, hookId);

  // Then fetch the hook with resolveData=all
  const { data: fullHook, error: fullHookError } = useSWR(
    initialHook ? ['hook-full', config, hookId] : null,
    () => fetchHook(config, hookId),
    { revalidateOnFocus: false }
  );

  // Fetch all events for the run to find hook invocations
  const [hookEvents, setHookEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!initialHook?.runId) return;

    const fetchHookEvents = async () => {
      try {
        // Fetch events related to this hook
        const allEvents: Event[] = [];
        let cursor: string | undefined;

        // Fetch all events for this run (up to a reasonable limit)
        for (let i = 0; i < 10; i++) {
          const result = await fetchEvents(
            config,
            initialHook.runId,
            cursor,
            'asc',
            100
          );
          allEvents.push(...result.data);
          if (!result.hasMore || !result.cursor) break;
          cursor = result.cursor;
        }

        // Filter to only hook-related events for this hookId
        const relevantEvents = allEvents.filter(
          (e) =>
            e.correlationId === hookId &&
            (e.eventType === 'hook_created' ||
              e.eventType === 'hook_received' ||
              e.eventType === 'hook_disposed')
        );

        setHookEvents(relevantEvents);
      } catch (err) {
        console.error('Failed to fetch hook events:', err);
      }
    };

    fetchHookEvents();
  }, [initialHook?.runId, hookId, config]);

  const error = initialError || fullHookError;
  const isLoading = initialLoading || !fullHook;

  if (error) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
        <div className="text-center py-8 text-red-600">
          Error: {error.message}
        </div>
      </SidePanel>
    );
  }

  if (isLoading) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
        <div className="text-center py-8">Loading...</div>
      </SidePanel>
    );
  }

  if (!fullHook) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
        <div className="text-center py-8">Hook not found</div>
      </SidePanel>
    );
  }

  // Count hook invocations (hook_received events)
  const invocations = hookEvents.filter((e) => e.eventType === 'hook_received');

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
      <div className="space-y-4">
        {/* Hook Invocations Summary */}
        {invocations.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">
              Hook Invocations ({invocations.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {invocations.map((event) => (
                <div
                  key={event.eventId}
                  className="text-xs bg-background rounded p-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Invoked</span>
                    <RelativeTime date={event.createdAt} />
                  </div>
                  {event.eventData && (
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {JSON.stringify(event.eventData).substring(0, 100)}
                      {JSON.stringify(event.eventData).length > 100
                        ? '...'
                        : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Hook JSON */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Hook Data</h3>
          <JsonView data={fullHook} showCard={false} />
        </div>
      </div>
    </SidePanel>
  );
}
