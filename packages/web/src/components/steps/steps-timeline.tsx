'use client';

import type { Step } from '@vercel/workflow-world';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getResourceName } from '@/lib/resource-name';
import { cn, formatDuration } from '@/lib/utils';
import { StatusBadge } from '../display-utils/status-badge';

interface StepsTimelineProps {
  steps: Step[];
  hasMore: boolean;
  onStepClick: (stepId: string) => void;
  onLoadMore?: () => void;
  selectedStepId?: string;
  runStartTime?: string;
  runEndTime?: string;
}

interface TimelineItem {
  id: string;
  type: 'run' | 'step';
  name: string;
  status: Step['status'] | 'running' | 'completed';
  startTime: number;
  endTime: number;
  isOngoing: boolean;
  step?: Step;
}

const MIN_BAR_WIDTH_PX = 8;
const BAR_HEIGHT_PX = 16;
const ROW_GAP_PX = 8;
const MAX_CHART_HEIGHT_PX = 512;

const statusToColor = (status: Step['status'] | 'running' | 'completed') => {
  switch (status) {
    case 'running':
      return 'bg-blue-500 border-blue-600';
    case 'completed':
      return 'bg-green-500 border-green-600';
    case 'failed':
      return 'bg-red-500 border-red-600';
    case 'cancelled':
      return 'bg-yellow-500 border-yellow-600';
    case 'pending':
      return 'bg-gray-400 border-gray-500';
    default:
      return 'bg-gray-400 border-gray-500';
  }
};

function TimelineBar({
  item,
  leftPx,
  widthPx,
  isSelected,
  onClick,
}: {
  item: TimelineItem;
  leftPx: number;
  widthPx: number;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const isRunning = item.status === 'running' || item.isOngoing;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          className={cn(
            'absolute rounded-sm border transition-all',
            'flex items-center px-1.5 text-[10px] font-medium text-white',
            onClick &&
              'cursor-pointer hover:brightness-110 hover:scale-y-110 hover:z-10',
            !onClick && 'cursor-default',
            isSelected && 'ring-2 ring-primary ring-offset-1 z-10',
            isRunning && 'animate-pulse',
            statusToColor(item.status)
          )}
          style={{
            left: `${leftPx}px`,
            width: `${widthPx}px`,
            height: `${BAR_HEIGHT_PX}px`,
            top: '0px',
          }}
        >
          <span className="truncate leading-none text-black bold">
            {item.name}
          </span>
          {item.isOngoing && (
            <span className="ml-1 flex-shrink-0 text-[8px]">●</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <div className="space-y-1">
          <div className="font-semibold">{item.name}</div>
          <div className="text-xs space-y-0.5">
            {item.type === 'step' && item.step && (
              <>
                <div>Step ID: {item.step.stepId}</div>
                <div className="flex items-center gap-1">
                  Status:{' '}
                  <StatusBadge
                    status={item.step.status}
                    context={item.step}
                    className="text-xs"
                  />
                </div>
              </>
            )}
            {item.type === 'run' && (
              <div>
                Status: {item.isOngoing ? 'Running' : 'Completed'}
                {item.isOngoing && ' (ongoing)'}
              </div>
            )}
            <div>
              Duration: {formatDuration(item.startTime, item.endTime)}
              {item.isOngoing && ' (so far)'}
            </div>
            <div>Started: {new Date(item.startTime).toLocaleTimeString()}</div>
            {!item.isOngoing && (
              <div>Ended: {new Date(item.endTime).toLocaleTimeString()}</div>
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
  onLoadMore,
  selectedStepId,
  runStartTime,
  runEndTime,
}: StepsTimelineProps) {
  if (steps.length === 0 || !runStartTime) {
    return null;
  }

  const now = Date.now();
  const runStart = new Date(runStartTime).getTime();
  const runEnd = runEndTime ? new Date(runEndTime).getTime() : now;
  const runIsOngoing = !runEndTime;
  const totalDuration = runEnd - runStart;

  // Filter steps that have start times
  const stepsWithTimes = steps.filter((step) => step.startedAt);

  // Create timeline items: run + steps
  const items: TimelineItem[] = [
    {
      id: 'run',
      type: 'run',
      name: 'Run',
      status: runIsOngoing ? 'running' : 'completed',
      startTime: runStart,
      endTime: runEnd,
      isOngoing: runIsOngoing,
    },
    ...stepsWithTimes.map((step): TimelineItem => {
      const stepStart = step.startedAt
        ? new Date(step.startedAt).getTime()
        : runStart;
      const stepEnd = step.completedAt
        ? new Date(step.completedAt).getTime()
        : now;
      const stepIsOngoing = !step.completedAt && step.status === 'running';

      return {
        id: step.stepId,
        type: 'step',
        name: getResourceName(step.stepName),
        status: step.status,
        startTime: stepStart,
        endTime: stepEnd,
        isOngoing: stepIsOngoing,
        step,
      };
    }),
  ];

  // Calculate minimum width needed for the chart
  // Each item needs at least MIN_BAR_WIDTH_PX
  const rowCount = items.length;

  // Calculate the width needed to show all bars at minimum width
  // For this, we need to check the smallest duration and ensure it gets MIN_BAR_WIDTH_PX
  let chartWidthPx = 600; // default minimum width

  // Find the shortest duration as a percentage of total
  const shortestDurationPct = Math.min(
    ...items.map((item) => {
      const duration = item.endTime - item.startTime;
      return (duration / totalDuration) * 100;
    })
  );

  // Calculate width needed: if shortest bar is X% of total, and needs MIN_BAR_WIDTH_PX,
  // then total width = MIN_BAR_WIDTH_PX / (X / 100)
  const minRequiredWidth = MIN_BAR_WIDTH_PX / (shortestDurationPct / 100);
  chartWidthPx = Math.max(chartWidthPx, minRequiredWidth);

  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">Timeline</div>
      {/* Chart container with vertical scroll */}
      <div
        className="overflow-y-auto bg-muted/20 rounded-lg border"
        style={{ maxHeight: `${MAX_CHART_HEIGHT_PX}px` }}
      >
        {/* Horizontal scrolling container */}
        <div className="overflow-x-auto">
          <div
            className="relative p-4"
            style={{
              width: `${chartWidthPx}px`,
              minWidth: '100%',
              height: `${rowCount * (BAR_HEIGHT_PX + ROW_GAP_PX)}px`,
            }}
          >
            {items.map((item, index) => {
              const offsetFromStart = item.startTime - runStart;
              const duration = item.endTime - item.startTime;

              const leftPx = (offsetFromStart / totalDuration) * chartWidthPx;
              const widthPx = Math.max(
                (duration / totalDuration) * chartWidthPx,
                MIN_BAR_WIDTH_PX
              );

              const topPx = index * (BAR_HEIGHT_PX + ROW_GAP_PX);

              return (
                <div
                  key={item.id}
                  className="absolute"
                  style={{
                    top: `${topPx}px`,
                    left: 0,
                    right: 0,
                    height: `${BAR_HEIGHT_PX}px`,
                  }}
                >
                  <TimelineBar
                    item={item}
                    leftPx={leftPx}
                    widthPx={widthPx}
                    isSelected={item.id === selectedStepId}
                    onClick={
                      item.type === 'step' && item.step
                        ? () => {
                            if (item.step) {
                              onStepClick(item.step.stepId);
                            }
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}

            {/* Load more indicator */}
            {hasMore &&
              onLoadMore &&
              items.length > 1 &&
              (() => {
                // Find the last step (skip the run which is first)
                const lastStep = items[items.length - 1];
                const lastStepOffsetFromStart = lastStep.endTime - runStart;
                const lastStepEndPx =
                  (lastStepOffsetFromStart / totalDuration) * chartWidthPx;

                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onLoadMore}
                        className="absolute bg-gray-400/30 hover:bg-gray-400/40 transition-colors cursor-pointer"
                        style={{
                          left: `${lastStepEndPx + 8}px`,
                          top: 0,
                          right: 0,
                          height: `${rowCount * (BAR_HEIGHT_PX + ROW_GAP_PX)}px`,
                        }}
                        aria-label="Load more steps"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        There may be more steps after this, click here to load
                        more
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
          </div>
        </div>
      </div>
      {/* Time labels */}
      <div className="flex justify-between text-xs text-muted-foreground pt-2">
        <span>{new Date(runStart).toLocaleTimeString()}</span>
        <span>
          Duration: {formatDuration(runStartTime, runEndTime)}
          {runIsOngoing && ' (ongoing)'}
        </span>
        <span>
          {runIsOngoing ? 'Now' : new Date(runEnd).toLocaleTimeString()}
        </span>
      </div>{' '}
    </div>
  );
}
