'use client';

import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEvents } from '@/hooks/use-api';
import type { WorldConfig } from '@/lib/world';
import { PageSizeDropdown } from '../display-utils/page-size-dropdown';
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<number>(10);

  const {
    data,
    error,
    loading,
    paginationDisplay,
    lastRefreshTime,
    handleNextPage,
    handlePrevPage,
    handleRefresh,
    canGoNext,
    canGoPrev,
  } = useEvents(config, runId, sortOrder, limit);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const truncate = (str: string | undefined, maxLength = 30) => {
    if (!str) return '';
    return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
  };

  // Show skeleton for initial load
  if (loading && !data) {
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSortOrder}
                  disabled={loading}
                >
                  {sortOrder === 'desc' ? (
                    <ArrowDownAZ className="h-4 w-4" />
                  ) : (
                    <ArrowUpAZ className="h-4 w-4" />
                  )}
                  {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sortOrder === 'desc'
                  ? 'Showing newest first'
                  : 'Showing oldest first'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading events</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'An error occurred'}
            </AlertDescription>
          </Alert>
        ) : !data || data.data.length === 0 ? (
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
                {data.data.map((event) => (
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
                {paginationDisplay}
              </div>
              <div className="flex gap-2 items-center">
                <PageSizeDropdown value={limit} onChange={setLimit} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={!canGoPrev}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!canGoNext}
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
