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
import { useStepsWithPreload } from '@/hooks/use-steps-with-preload';
import { getResourceName } from '@/lib/resource-name';
import { DEFAULT_PAGE_SIZE } from '@/lib/utils';
import type { WorldConfig } from '@/lib/world';
import { PageSizeDropdown } from '../display-utils/page-size-dropdown';
import { RelativeTime } from '../display-utils/relative-time';
import { StatusBadge } from '../display-utils/status-badge';
import { TableSkeleton } from '../display-utils/table-skeleton';
import { StepsTimeline } from './steps-timeline';
import { StepsTimelineLoadingSkeleton } from './steps-timeline-skeleton';

interface StepsTableProps {
  config: WorldConfig;
  runId: string;
  onStepClick: (stepId: string) => void;
  selectedStepId?: string;
  runStartTime?: string;
  runEndTime?: string;
}

export function StepsTable({
  config,
  runId,
  onStepClick,
  selectedStepId,
  runStartTime,
  runEndTime,
}: StepsTableProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);

  const {
    data,
    error,
    loading,
    currentPageNumber,
    maxPagesVisited,
    paginationDisplay,
    lastRefreshTime,
    handleNextPage,
    handlePrevPage,
    handleRefresh,
    canGoNext,
    canGoPrev,
    allSteps,
  } = useStepsWithPreload(config, runId, sortOrder, limit);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  // Show skeleton for initial load
  if (loading && !data) {
    return <TableSkeleton title="Steps" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Steps</CardTitle>
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
            <AlertTitle>Error loading steps</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'An error occurred'}
            </AlertDescription>
          </Alert>
        ) : !data || data.data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No steps found
          </div>
        ) : (
          <>
            {/* Timeline Chart */}
            <div className="mb-6">
              {loading ? (
                <StepsTimelineLoadingSkeleton />
              ) : (
                <StepsTimeline
                  steps={allSteps}
                  hasMore={
                    currentPageNumber === maxPagesVisited && data.hasMore
                  }
                  onStepClick={onStepClick}
                  onLoadMore={handleNextPage}
                  selectedStepId={selectedStepId}
                  runStartTime={runStartTime}
                  runEndTime={runEndTime}
                />
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step ID</TableHead>
                  <TableHead>Step Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((step) => (
                  <TableRow
                    key={step.stepId}
                    className={`cursor-pointer ${
                      selectedStepId === step.stepId
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => onStepClick(step.stepId)}
                  >
                    <TableCell className="font-mono text-xs">
                      {step.stepId}
                    </TableCell>
                    <TableCell>{getResourceName(step.stepName)}</TableCell>
                    <TableCell>
                      <StatusBadge status={step.status} context={step} />
                    </TableCell>
                    <TableCell>
                      {step.startedAt ? (
                        <RelativeTime date={step.startedAt} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {step.completedAt ? (
                        <RelativeTime date={step.completedAt} />
                      ) : (
                        '-'
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
