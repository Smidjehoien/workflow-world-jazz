'use client';

import type { Step } from '@vercel/workflow-world';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useCallback, useMemo } from 'react';
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
import { getResourceName } from '@/lib/resource-name';
import { fetchSteps, type WorldConfig } from '@/lib/world';
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
  const fetchFn = useCallback(
    (cursor?: string) => fetchSteps(config, runId, cursor),
    [config, runId]
  );

  const {
    currentPage,
    pages,
    currentPageIndex,
    loading,
    lastRefreshTime,
    handleNextPage,
    handlePrevPage,
    handleRefresh,
  } = usePagination<Step>({ fetchFn });

  const allSteps = useMemo(() => {
    return pages.flatMap((page) => page.data);
  }, [pages]);
  const hasMore = useMemo(() => {
    return pages.length > 0 && pages[pages.length - 1].hasMore;
  }, [pages]);

  // Show skeleton for initial load
  if (loading && !currentPage) {
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!currentPage || currentPage.data.length === 0 ? (
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
                  hasMore={hasMore}
                  onStepClick={onStepClick}
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
                {currentPage.data.map((step) => (
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
