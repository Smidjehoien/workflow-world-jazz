'use client';

import { parseWorkflowName } from '@vercel/workflow-core/parse-name';
import type { Event, Hook, Step } from '@vercel/workflow-world';
import { ChevronRight, Radio } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { createAPICallKey, useRun } from '@/hooks/use-api';
import { useExhaustiveList } from '@/hooks/use-exhaustive-list';
import type { WorldConfig } from '@/lib/config-world';
import { formatDuration } from '@/lib/utils';
import { fetchEvents, fetchHooks, fetchSteps } from '@/lib/world';
import { RelativeTime } from '../display-utils/relative-time';
import { StatusBadge } from '../display-utils/status-badge';
import { ErrorBoundary } from '../error-boundary';
import { EventsTable } from '../events/events-table';
import { HooksTable } from '../hooks/hooks-table';
import { StepDetailSidebar } from '../steps/step-detail-sidebar';
import { StepsTable } from '../steps/steps-table';
import { RunDetailSidebar } from './run-detail-sidebar';

interface RunDetailViewProps {
  config: WorldConfig;
  runId: string;
  selectedStepId?: string;
  selectedEventId?: string;
  selectedHookId?: string;
  onStepSelect: (stepId: string | undefined) => void;
  onEventSelect: (eventId: string | undefined) => void;
  onHookSelect: (hookId: string | undefined) => void;
  onStreamClick: (streamId: string) => void;
}

export function RunDetailView({
  config,
  runId,
  selectedStepId,
  selectedEventId,
  selectedHookId,
  onStepSelect,
  onEventSelect,
  onHookSelect,
  onStreamClick,
}: RunDetailViewProps) {
  const [liveMode, setLiveMode] = useState(false);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const {
    data: run,
    isLoading: runLoading,
    error: runError,
  } = useRun(config, runId, {
    refreshInterval: liveMode ? 5000 : 0,
  });

  // Fetch steps exhaustively
  const {
    items: allSteps,
    loading: stepsLoading,
    error: stepsError,
    hasHitLimit: stepsHitLimit,
    hasReachedEnd: stepsHasReachedEnd,
    initialLoadComplete: stepsInitialLoadComplete,
  } = useExhaustiveList<Step, { config: WorldConfig; runId: string }>({
    createKey: (params, cursor) =>
      createAPICallKey(
        params.config,
        'steps-exhaustive',
        params.runId,
        cursor,
        'asc'
      ),
    fetcher: async (params, cursor, sortOrder, limit) => {
      return fetchSteps(params.config, params.runId, cursor, sortOrder, limit);
    },
    params: { config, runId },
    live: liveMode,
  });

  // Fetch events exhaustively
  const {
    items: allEvents,
    loading: eventsLoading,
    error: eventsError,
    hasHitLimit: eventsHitLimit,
    hasReachedEnd: eventsHasReachedEnd,
    initialLoadComplete: eventsInitialLoadComplete,
  } = useExhaustiveList<Event, { config: WorldConfig; runId: string }>({
    createKey: (params, cursor) =>
      createAPICallKey(
        params.config,
        'events-exhaustive',
        params.runId,
        cursor,
        'asc'
      ),
    fetcher: async (params, cursor, sortOrder, limit) => {
      return fetchEvents(params.config, params.runId, cursor, sortOrder, limit);
    },
    params: { config, runId },
    live: liveMode,
  });

  // Fetch hooks exhaustively
  const {
    items: allHooks,
    loading: hooksLoading,
    error: hooksError,
    hasHitLimit: hooksHitLimit,
    hasReachedEnd: hooksHasReachedEnd,
    initialLoadComplete: hooksInitialLoadComplete,
  } = useExhaustiveList<Hook, { config: WorldConfig; runId: string }>({
    createKey: (params, cursor) =>
      createAPICallKey(
        params.config,
        'hooks-exhaustive',
        params.runId,
        cursor,
        'asc'
      ),
    fetcher: async (params, cursor, sortOrder, limit) => {
      return fetchHooks(params.config, params.runId, cursor, sortOrder, limit);
    },
    params: { config, runId },
    live: liveMode,
  });

  const handleStreamClickFromJson = (streamId: string) => {
    onStreamClick(streamId);
  };

  const liveModeId = useId();

  // Update current time every second when live mode is active and run is ongoing
  useEffect(() => {
    if (liveMode && run && !run.completedAt) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [liveMode, run?.completedAt, run]);

  if (runLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (runError) {
    return <div className="text-center py-8">Error: {runError.message}</div>;
  }

  if (!run) {
    return <div className="text-center py-8">Run not found</div>;
  }

  // Calculate duration - use current time for ongoing runs
  const isOngoing = !run.completedAt;
  const endTimeForDuration = isOngoing
    ? new Date(currentTime)
    : run.completedAt;
  const duration = formatDuration(run.startedAt, endTimeForDuration);

  return (
    <div className="space-y-6">
      {/* Run Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Run Overview</CardTitle>
            <div className="flex items-center gap-2">
              {liveMode && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    Live updates active
                  </span>
                </div>
              )}
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Run ID</div>
              <div className="font-mono text-xs">{run.runId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Workflow</div>
              <div>{parseWorkflowName(run.workflowName)?.shortName || '?'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div>
                <StatusBadge status={run.status} context={run} />
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Started</div>
              <div>
                {run.startedAt ? <RelativeTime date={run.startedAt} /> : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div>
                {run.completedAt ? (
                  <RelativeTime date={run.completedAt} />
                ) : (
                  '-'
                )}
              </div>
            </div>
            {duration && (
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div>
                  {duration}
                  {isOngoing && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (ongoing)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRunDetails(true)}
              className="justify-between"
            >
              <span>View Details (JSON)</span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Run Details JSON Side Panel */}
            {showRunDetails && (
              <RunDetailSidebar
                runData={run}
                runId={runId}
                onClose={() => setShowRunDetails(false)}
                onStreamClick={handleStreamClickFromJson}
              />
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onStreamClick(runId)}
              className="justify-between"
            >
              <span>View Output Stream</span>
              <Radio className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Steps Table */}
      <ErrorBoundary
        title="Steps Error"
        description="Failed to load steps. Please try refreshing the page."
      >
        <StepsTable
          steps={allSteps}
          events={allEvents}
          hooks={allHooks}
          loading={stepsLoading}
          error={stepsError || undefined}
          hasHitLimit={stepsHitLimit}
          hasReachedEnd={stepsHasReachedEnd}
          initialLoadComplete={stepsInitialLoadComplete}
          onStepClick={onStepSelect}
          onRunClick={() => setShowRunDetails(true)}
          onHookClick={onHookSelect}
          selectedStepId={selectedStepId}
          runStartTime={run.startedAt?.toISOString()}
          runEndTime={run.completedAt?.toISOString()}
          runCreatedAt={run.createdAt?.toISOString()}
        />
      </ErrorBoundary>
      {/* Step Detail Side Panel */}
      {selectedStepId && (
        <ErrorBoundary
          title="Step Detail Error"
          description="Failed to load step details. Please try selecting another step."
        >
          <StepDetailSidebar
            config={config}
            runId={runId}
            stepId={selectedStepId}
            onClose={() => onStepSelect(undefined)}
            onStreamClick={onStreamClick}
          />
        </ErrorBoundary>
      )}

      {/* Events Table */}
      <ErrorBoundary
        title="Events Error"
        description="Failed to load events. Please try refreshing the page."
      >
        <EventsTable
          config={config}
          runId={runId}
          events={allEvents}
          loading={eventsLoading}
          error={eventsError || undefined}
          initialLoadComplete={eventsInitialLoadComplete}
          hasHitLimit={eventsHitLimit}
          hasReachedEnd={eventsHasReachedEnd}
          onEventClick={onEventSelect}
          selectedEventId={selectedEventId}
          onCloseDetailSidebar={() => onEventSelect(undefined)}
        />
      </ErrorBoundary>

      {/* Hooks Table */}
      <ErrorBoundary
        title="Hooks Error"
        description="Failed to load hooks. Please try refreshing the page."
      >
        <HooksTable
          config={config}
          runId={runId}
          hooks={allHooks}
          loading={hooksLoading}
          error={hooksError || undefined}
          initialLoadComplete={hooksInitialLoadComplete}
          hasHitLimit={hooksHitLimit}
          hasReachedEnd={hooksHasReachedEnd}
          onHookClick={onHookSelect}
          selectedHookId={selectedHookId}
          onCloseDetailSidebar={() => onHookSelect(undefined)}
        />
      </ErrorBoundary>
    </div>
  );
}
