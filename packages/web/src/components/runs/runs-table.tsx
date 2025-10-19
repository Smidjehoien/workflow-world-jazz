'use client';

import { parseWorkflowName } from '@vercel/workflow-core/parse-name';
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { useRuns } from '@/hooks/use-api';
import type { WorldConfig } from '@/lib/config-world';
import { get403ErrorMessage } from '@/lib/errors';
import { DEFAULT_PAGE_SIZE } from '@/lib/utils';
import { PageSizeDropdown } from '../display-utils/page-size-dropdown';
import { RelativeTime } from '../display-utils/relative-time';
import { StatusBadge } from '../display-utils/status-badge';
import { TableSkeleton } from '../display-utils/table-skeleton';

interface RunsTableProps {
  config: WorldConfig;
  onRunClick: (runId: string) => void;
  onStreamClick?: (runId: string, streamId: string) => void;
}

/**
 * RunsTable - Displays workflow runs with server-side pagination.
 * Uses the PaginatingTable pattern: fetches data for each page as needed from the server.
 * The table and fetching behavior are intertwined - pagination controls trigger new API calls.
 *
 * This is in contrast to LocalPaginatingTable (used by StepsTable and EventsTable),
 * which fetches all data upfront and paginates client-side.
 */
export function RunsTable({
  config,
  onRunClick,
  onStreamClick,
}: RunsTableProps) {
  const [liveMode, setLiveMode] = useState(false);
  const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);

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
  } = useRuns(config, {
    refreshInterval: liveMode ? 5000 : 0,
    sortOrder,
    limit,
  });

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const liveModeId = useId();

  // Show skeleton for initial load
  if (loading && !data) {
    return <TableSkeleton title="Workflow Runs" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workflow Runs</CardTitle>
          <div className="flex items-center gap-4">
            {
              <>
                {lastRefreshTime && (
                  <RelativeTime
                    date={lastRefreshTime}
                    className="text-sm text-muted-foreground"
                    type="distance"
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={liveMode}
                        onCheckedChange={setLiveMode}
                        id={liveModeId}
                      />
                      <label
                        htmlFor={liveModeId}
                        className="text-sm font-medium cursor-pointer"
                      >
                        Live
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Refreshes automatically every 5 seconds. Note that this
                    resets pages
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={loading}
                    >
                      <RefreshCw className={loading ? 'animate-spin' : ''} />
                      Refresh
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Note that this resets pages</TooltipContent>
                </Tooltip>
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
              </>
            }
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading runs</AlertTitle>
            <AlertDescription>{get403ErrorMessage(error)}</AlertDescription>
          </Alert>
        ) : !data || data.data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No runs found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((run) => (
                  <TableRow
                    key={run.runId}
                    className="cursor-pointer group relative"
                    onMouseEnter={() => setHoveredRunId(run.runId)}
                    onMouseLeave={() => setHoveredRunId(null)}
                    onClick={(e) => {
                      // Don't navigate if clicking on action buttons
                      const target = e.target as HTMLElement;
                      if (target.closest('.action-buttons')) {
                        return;
                      }
                      onRunClick(run.runId);
                    }}
                  >
                    <TableCell>
                      {parseWorkflowName(run.workflowName)?.shortName || '?'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {run.runId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} context={run} />
                    </TableCell>
                    <TableCell>
                      {run.startedAt ? (
                        <RelativeTime date={run.startedAt} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {run.completedAt ? (
                        <RelativeTime date={run.completedAt} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="relative">
                      {hoveredRunId === run.runId && (
                        <div className="action-buttons absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-lg border">
                          {onStreamClick && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStreamClick(run.runId, run.runId);
                                  }}
                                >
                                  <Radio className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                View Output Stream
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
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
