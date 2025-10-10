'use client';

import type { Event } from '@vercel/workflow-world';
import { useMemo } from 'react';
import useSWR from 'swr';
import { createEventKey } from '@/hooks/use-api';
import type { PaginatedResult } from '@/hooks/use-paginated-query';
import { fetchEvents, type WorldConfig } from '@/lib/world';
import { JsonView } from '../display-utils/json-view';
import { SidePanel } from '../display-utils/side-panel';

interface EventDetailSidebarProps {
  config: WorldConfig;
  runId: string;
  eventId: string;
  onClose: () => void;
  currentPageInfo: {
    sortOrder: 'asc' | 'desc';
    limit: number;
    cursor?: string;
  };
}

/**
 * WEIRD but we don't have a get endpoint for events, so if we want to hydrate full
 * data for an event, we need to re-fetch the same list call that originated the event
 * we want to inspect with different args, which is why we're passing the cursor/sort order/limit.
 */
export function EventDetailSidebar({
  config,
  runId,
  eventId,
  onClose,
  currentPageInfo,
}: EventDetailSidebarProps) {
  const params = useMemo(
    () => ({
      config,
      runId,
      sortOrder: currentPageInfo.sortOrder,
      limit: currentPageInfo.limit,
    }),
    [config, runId, currentPageInfo]
  );
  const { data, error, isLoading } = useSWR<PaginatedResult<Event>>(
    () => `${createEventKey(params, currentPageInfo.cursor)}:detail`,
    () =>
      fetchEvents(
        params.config,
        params.runId,
        currentPageInfo.cursor,
        params.sortOrder,
        params.limit,
        true // withData
      ),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  if (error) {
    return <div className="text-center py-8">Error: {error.message}</div>;
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const event = data?.data.find((event) => event.eventId === eventId);

  if (!event) {
    return <div className="text-center py-8">Event not found</div>;
  }

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Event Details">
      <JsonView data={event} showCard={false} />
    </SidePanel>
  );
}
