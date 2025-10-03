'use client';

import type { Event } from '@vercel/workflow-world';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePagination } from '@/hooks/use-pagination';
import { fetchEvents, type WorldConfig } from '@/lib/world';
import { RelativeTime } from '../display-utils/relative-time';
import { TableSkeleton } from '../display-utils/table-skeleton';

interface EventsTableProps {
  config: WorldConfig;
  runId: string;
  onEventClick: (eventId: string) => void;
  selectedEventId?: string;
}

export function EventsTable({
  config,
  runId,
  onEventClick,
  selectedEventId,
}: EventsTableProps) {
  const fetchFn = useCallback(
    (cursor?: string) => fetchEvents(config, runId, cursor),
    [config, runId]
  );

  const {
    currentPage,
    currentPageIndex,
    loading,
    lastRefreshTime,
    handleNextPage,
    handlePrevPage,
    handleRefresh,
  } = usePagination<Event>({ fetchFn });

  const truncate = (str: string | undefined, maxLength = 30) => {
    if (!str) return '';
    return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
  };

  // Show skeleton for initial load
  if (loading && !currentPage) {
    return <TableSkeleton title="Events" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Events</CardTitle>
          <div className="flex items-center gap-4">
            {lastRefreshTime && (
              <RelativeTime
                date={lastRefreshTime}
                className="text-sm text-muted-foreground"
                type="distance"
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!currentPage || currentPage.data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No events found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Correlation ID</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPage.data.map((event) => (
                  <TableRow
                    key={event.eventId}
                    className={`cursor-pointer ${
                      selectedEventId === event.eventId
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => onEventClick(event.eventId)}
                  >
                    <TableCell className="font-mono text-xs">
                      {truncate(event.eventId, 30)}
                    </TableCell>
                    <TableCell>{event.eventType}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {truncate(event.correlationId, 30)}
                    </TableCell>
                    <TableCell>
                      <RelativeTime date={event.createdAt} />
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate">
                      {'eventData' in event &&
                      Object.keys(event.eventData || {}).length > 0
                        ? truncate(
                            JSON.stringify(
                              (event as { eventData?: unknown }).eventData ?? {}
                            ),
                            20
                          )
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPageIndex + 1}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPageIndex === 0}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!currentPage.hasMore}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
