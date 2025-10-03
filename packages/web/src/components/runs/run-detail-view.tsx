'use client';

import type { WorkflowRun } from '@vercel/workflow-world';
import { ChevronRight, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getResourceName } from '@/lib/resource-name';
import { fetchRun, type WorldConfig } from '@/lib/world';
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
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [showRunDetails, setShowRunDetails] = useState(false);

  // Fetch run details
  useEffect(() => {
    setRunLoading(true);
    fetchRun(config, runId)
      .then(setRun)
      .catch(console.error)
      .finally(() => setRunLoading(false));
  }, [config, runId]);

  // Auto-refresh run in live mode
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      fetchRun(config, runId).then(setRun).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveMode, config, runId]);

  const handleStreamClickFromJson = (streamId: string) => {
    onStreamClick(streamId);
  };

  if (runLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!run) {
    return <div className="text-center py-8">Run not found</div>;
  }

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
                id="run-live-mode"
              />
              <label
                htmlFor="run-live-mode"
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
            {run.startedAt && run.completedAt && (
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div>
                  {Math.round(
                    (new Date(run.completedAt).getTime() -
                      new Date(run.startedAt).getTime()) /
                      1000
                  )}
                  s
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

      {/* Events Table */}
      <EventsTable
        config={config}
        runId={runId}
        onEventClick={onEventSelect}
        selectedEventId={selectedEventId}
      />

      {/* Run Details JSON Side Panel */}
      {showRunDetails && (
        <RunDetailSidebar
          runData={run}
          runId={runId}
          onClose={() => setShowRunDetails(false)}
          onStreamClick={handleStreamClickFromJson}
        />
      )}

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

      {/* Event Detail Side Panel */}
      {selectedEventId && (
        <EventDetailSidebar
          config={config}
          runId={runId}
          eventId={selectedEventId}
          onClose={() => onEventSelect(undefined)}
        />
      )}
    </div>
  );
}
