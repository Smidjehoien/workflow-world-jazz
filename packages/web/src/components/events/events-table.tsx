'use client';

import type { Event } from '@vercel/workflow-world';
import type { WorldConfig } from '@/lib/config-world';
import type { ColumnDefinition } from '../display-utils/local-paginating-table';
import { LocalPaginatingTable } from '../display-utils/local-paginating-table';
import { RelativeTime } from '../display-utils/relative-time';
import { EventDetailSidebar } from './event-detail-sidebar';

interface EventsTableProps {
  config: WorldConfig;
  runId: string;
  events: Event[];
  loading: boolean;
  error?: Error;
  initialLoadComplete: boolean;
  hasHitLimit?: boolean;
  hasReachedEnd?: boolean;
  onEventClick: (eventId: string) => void;
  selectedEventId?: string;
  onCloseDetailSidebar: () => void;
}

/**
 * EventsTable - Displays events with local pagination.
 * Receives pre-fetched events data from parent component.
 */
export function EventsTable({
  config,
  runId,
  events,
  loading,
  error,
  initialLoadComplete,
  hasHitLimit = false,
  hasReachedEnd = false,
  onEventClick,
  selectedEventId,
  onCloseDetailSidebar,
}: EventsTableProps) {
  // Define table columns
  const columns: ColumnDefinition<Event>[] = [
    {
      key: 'eventId',
      header: 'Event ID',
      render: (event) => (
        <span className="font-mono text-xs">{event.eventId}</span>
      ),
    },
    {
      key: 'eventType',
      header: 'Event Type',
      render: (event) => event.eventType,
    },
    {
      key: 'correlationId',
      header: 'Correlation ID',
      render: (event) => (
        <span className="font-mono text-xs">{event.correlationId}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      render: (event) => <RelativeTime date={event.createdAt} />,
    },
  ];

  return (
    <>
      {selectedEventId && (
        <EventDetailSidebar
          config={config}
          currentPageInfo={{
            sortOrder: 'asc',
            limit: 1000,
            cursor: undefined,
          }}
          runId={runId}
          eventId={selectedEventId}
          onClose={() => onCloseDetailSidebar()}
        />
      )}
      <LocalPaginatingTable
        items={events}
        columns={columns}
        title="Events"
        loading={loading && !initialLoadComplete}
        error={error}
        getItemKey={(event) => event.eventId}
        onRowClick={(event) => onEventClick(event.eventId)}
        isRowSelected={(event) => event.eventId === selectedEventId}
        emptyMessage="No events found"
        hasHitLimit={hasHitLimit}
        hasReachedEnd={hasReachedEnd}
      />
    </>
  );
}
