'use client';

import type { Step } from '@vercel/workflow-world';
import { formatRelative } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getResourceName } from '@/lib/resource-name';
import { cn } from '@/lib/utils';
import { StatusBadge } from '../display-utils/status-badge';

interface StepsTimelineProps {
  steps: Step[];
  hasMore: boolean;
  onStepClick: (stepId: string) => void;
  selectedStepId?: string;
  runStartTime?: string;
  runEndTime?: string;
}

interface StepPosition {
  step: Step;
  leftPercent: number;
  widthPercent: number;
  duration: number;
}

const statusToColor = (status: Step['status']) => {
  switch (status) {
    case 'running':
      return 'bg-blue-500/20 border-blue-500';
    case 'completed':
      return 'bg-green-500/20 border-green-500';
    case 'failed':
      return 'bg-red-500/20 border-red-500';
    case 'cancelled':
      return 'bg-yellow-500/20 border-yellow-500';
    case 'pending':
      return 'bg-gray-500/20 border-gray-500';
    default:
      return 'bg-gray-500/20 border-gray-500';
  }
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

/**
 * Takes a date and returns `<absoluteTime> (relativeTime) in <duration>`
 */
const durationTooltipContent = (date: Date) => {
  const absoluteTime = date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const relativeTime = formatRelative(date, new Date());
  return `${absoluteTime} (${relativeTime})`;
};

const calculateStepPositions = (
  steps: Step[],
  minTime: number,
  maxTime: number
): StepPosition[] => {
  const timeRange = maxTime - minTime;

  return steps.map((step) => {
    const start = step.startedAt ? new Date(step.startedAt).getTime() : 0;
    const end = step.completedAt
      ? new Date(step.completedAt).getTime()
      : Date.now();

    const leftPercent = ((start - minTime) / timeRange) * 100;
    const widthPercent = ((end - start) / timeRange) * 100;

    return {
      step,
      leftPercent,
      widthPercent: Math.max(widthPercent, 1), // Minimum 1% width for visibility
      duration: end - start,
    };
  });
};

const groupIntoLanes = (positions: StepPosition[]): StepPosition[][] => {
  const lanes: StepPosition[][] = [];

  for (const pos of positions) {
    let placed = false;

    for (const lane of lanes) {
      const overlaps = lane.some((existing) => {
        const existingEnd = existing.leftPercent + existing.widthPercent;
        const posEnd = pos.leftPercent + pos.widthPercent;
        return !(
          posEnd <= existing.leftPercent || pos.leftPercent >= existingEnd
        );
      });

      if (!overlaps) {
        lane.push(pos);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lanes.push([pos]);
    }
  }

  return lanes;
};

function StepTimelineItem({
  position,
  isSelected,
  onStepClick,
}: {
  position: StepPosition;
  isSelected: boolean;
  onStepClick: (stepId: string) => void;
}) {
  const isRunning = position.step.status === 'running';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onStepClick(position.step.stepId)}
          className={cn(
            'absolute h-10 rounded-xs border-2 transition-all cursor-pointer border-none',
            'flex items-center justify-center px-2 text-xs font-medium',
            'hover:z-10 hover:scale-102 hover:shadow-lg',
            isSelected && 'ring-1 ring-primary ring-offset-1 z-10',
            isRunning && 'animate-pulse',
            statusToColor(position.step.status)
          )}
          style={{
            left: `${position.leftPercent}%`,
            width: `${position.widthPercent}%`,
          }}
        >
          <span className="truncate">
            {getResourceName(position.step.stepName)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <div className="space-y-1">
          <div className="font-semibold">
            {getResourceName(position.step.stepName)}
          </div>
          <div className="text-xs space-y-0.5">
            <div>Step ID: {position.step.stepId}</div>
            <div>
              Status:{' '}
              <StatusBadge
                status={position.step.status}
                context={position.step}
                className="text-xs"
              />
            </div>
            <div>Duration: {formatDuration(position.duration)}</div>
            {position.step.startedAt && (
              <div>
                Started:{' '}
                {new Date(position.step.startedAt).toLocaleTimeString()}
              </div>
            )}
            {position.step.completedAt && (
              <div>
                Completed:{' '}
                {new Date(position.step.completedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function StepsTimeline({
  steps,
  hasMore,
  onStepClick,
  selectedStepId,
  runStartTime,
  runEndTime,
}: StepsTimelineProps) {
  if (steps.length === 0) {
    return null;
  }

  // Filter steps that have start times
  const stepsWithTimes = steps.filter((step) => step.startedAt);

  if (stepsWithTimes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground text-center py-4">
            No steps have started yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate time range - use run times if provided, otherwise use step times
  let minTime: number;
  let maxTime: number;

  if (runStartTime && runEndTime) {
    minTime = new Date(runStartTime).getTime();
    maxTime = new Date(runEndTime).getTime();
  } else {
    const startTimes = stepsWithTimes.map((s) =>
      s.startedAt ? new Date(s.startedAt).getTime() : 0
    );
    const endTimes = stepsWithTimes.map((s) =>
      s.completedAt ? new Date(s.completedAt).getTime() : Date.now()
    );
    minTime = Math.min(...startTimes);
    maxTime = Math.max(...endTimes);
  }
  const timeRange = maxTime - minTime;

  // Calculate positions for each step
  const stepPositions = calculateStepPositions(
    stepsWithTimes,
    minTime,
    maxTime
  );

  // Group overlapping steps into lanes
  const lanes = groupIntoLanes(stepPositions);

  // Calculate the height needed for all lanes
  const chartHeight = lanes.length * 48; // 40px height + 8px margin

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="text-sm text-muted-foreground mb-2">
          Timeline (showing {stepsWithTimes.length} step
          {stepsWithTimes.length !== 1 ? 's' : ''}){' '}
          {hasMore ? ' (load more pages to see more steps)' : ''}
        </div>
        <div className="relative bg-muted/20 rounded-lg p-4">
          {/* Run start marker */}
          {runStartTime && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary/40 hover:bg-primary/60 transition-colors cursor-help z-0"
                  style={{
                    left: '1%',
                    height: `${chartHeight}px`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  Run started at{' '}
                  {durationTooltipContent(new Date(runStartTime))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Run end marker */}
          {runEndTime && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary/40 hover:bg-primary/60 transition-colors cursor-help z-0"
                  style={{
                    left: '99%',
                    height: `${chartHeight}px`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  Run ended at {durationTooltipContent(new Date(runEndTime))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Step lanes */}
          {lanes.map((lane) => (
            <div
              key={lane.map((p) => p.step.stepId).join('-')}
              className="relative mb-2 h-10 last:mb-0"
            >
              {lane.map((pos) => (
                <StepTimelineItem
                  key={pos.step.stepId}
                  position={pos}
                  isSelected={selectedStepId === pos.step.stepId}
                  onStepClick={onStepClick}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground pt-2">
          <span>{new Date(minTime).toLocaleTimeString()}</span>
          <span>Duration: {formatDuration(timeRange)}</span>
          <span>{new Date(maxTime).toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
