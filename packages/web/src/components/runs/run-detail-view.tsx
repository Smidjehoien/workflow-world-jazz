'use client';

import { ChevronRight, Radio } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useRun } from '@/hooks/use-api';
import { getResourceName } from '@/lib/resource-name';
import { formatDuration } from '@/lib/utils';
import type { WorldConfig } from '@/lib/world';
import { RelativeTime } from '../display-utils/relative-time';
import { StatusBadge } from '../display-utils/status-badge';
import { EventDetailSidebar } from '../events/event-detail-sidebar';
import { EventsTable } from '../events/events-table';
import { StepDetailSidebar } from '../steps/step-detail-sidebar';
import { StepsTable } from '../steps/steps-table';
import { RunDetailSidebar } from './run-detail-sidebar';

interface RunDetailViewProps {
  config: WorldConfig;
  runId: string;
  selectedStepId?: string;
  selectedEventId?: string;
  onStepSelect: (stepId: string | undefined) => void;
  onEventSelect: (eventId: string | undefined) => void;
  onStreamClick: (streamId: string) => void;
}

export function RunDetailView({
  config,
  runId,
  selectedStepId,
  selectedEventId,
  onStepSelect,
  onEventSelect,
  onStreamClick,
}: RunDetailViewProps) {
  const [liveMode, setLiveMode] = useState(false);
  const [showRunDetails, setShowRunDetails] = useState(false);

  const {
    data: run,
    isLoading: runLoading,
    error: runError,
  } = useRun(config, runId, {
    refreshInterval: liveMode ? 5000 : 0,
  });

  const handleStreamClickFromJson = (streamId: string) => {
    onStreamClick(streamId);
  };

  const liveModeId = useId();

  if (runLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (runError) {
    return <div className="text-center py-8">Error: {runError.message}</div>;
  }

  if (!run) {
    return <div className="text-center py-8">Run not found</div>;
  }

  const duration = formatDuration(run.startedAt, run.completedAt);

  return (
    <div className="space-y-6">
      {/* Run Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Run Overview</CardTitle>
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
              <div>{getResourceName(run.workflowName)}</div>
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
                <div>{duration}</div>
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
      <StepsTable
        config={config}
        runId={runId}
        onStepClick={onStepSelect}
        selectedStepId={selectedStepId}
        runStartTime={run.startedAt?.toISOString()}
        runEndTime={run.completedAt?.toISOString()}
      />
      {/* Step Detail Side Panel */}
      {selectedStepId && (
        <StepDetailSidebar
          config={config}
          runId={runId}
          stepId={selectedStepId}
          onClose={() => onStepSelect(undefined)}
          onStreamClick={onStreamClick}
        />
      )}

      {/* Events Table */}
      <EventsTable
        config={config}
        runId={runId}
        onEventClick={onEventSelect}
        selectedEventId={selectedEventId}
        onCloseDetailSidebar={() => onEventSelect(undefined)}
      />
    </div>
  );
}
