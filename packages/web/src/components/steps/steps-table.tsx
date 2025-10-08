'use client';

import type { Step } from '@vercel/workflow-world';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { useSteps } from '@/hooks/use-api';
import { getResourceName } from '@/lib/resource-name';
import type { WorldConfig } from '@/lib/world';
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
  const [allSteps, setAllSteps] = useState<Step[]>([]);

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
    handleRefresh: baseHandleRefresh,
    canGoNext,
    canGoPrev,
  } = useSteps(config, runId);

  // Accumulate all steps across pages for timeline
  useEffect(() => {
    if (data?.data) {
      setAllSteps((prev) => {
        // If we're on first page, replace all
        if (currentPageNumber === 1) {
          return data.data;
        }
        // Otherwise, append new steps
        const existingIds = new Set(prev.map((s) => s.stepId));
        const newSteps = data.data.filter((s) => !existingIds.has(s.stepId));
        return [...prev, ...newSteps];
      });
    }
  }, [data, currentPageNumber]);

  const handleRefresh = () => {
    setAllSteps([]);
    baseHandleRefresh();
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
              <div className="flex gap-2">
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
