'use client';

import type { Event, Hook, Step } from '@vercel/workflow-world';
import { Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getResourceName } from '@/lib/resource-name';
import { cn, formatDuration } from '@/lib/utils';
import { StatusBadge } from '../display-utils/status-badge';

interface RunTraceViewProps {
  steps: Step[];
  events: Event[];
  hooks: Hook[];
  hasMore: boolean;
  onStepClick: (stepId: string) => void;
  onRunClick?: () => void;
  onHookClick?: (hookId: string) => void;
  onLoadMore?: () => void;
  selectedStepId?: string;
  runStartTime?: string;
  runEndTime?: string;
  runCreatedAt?: string;
}

interface TimelineItem {
  id: string;
  type: 'run' | 'step' | 'sleep' | 'hook';
  name: string;
  status: Step['status'] | 'running' | 'completed' | 'paused' | 'active';
  createdTime: number;
  startTime: number;
  endTime: number;
  isOngoing: boolean;
  step?: Step;
  hook?: Hook;
  hookId?: string;
}

interface TimelineMarker {
  id: string;
  type: 'hook_received' | 'step_retrying';
  itemId: string; // ID of the timeline item this marker belongs to
  time: number;
  event: Event;
}

// Layout constants
const MIN_BAR_WIDTH_PX = 8;
const BAR_HEIGHT_PX = 16;
const ROW_GAP_PX = 8;
const MAX_CHART_HEIGHT_PX = 512;
const LEFT_PANE_WIDTH_PX = 180;
const HEADER_HEIGHT_PX = 32;
const TIME_MARKER_COUNT = 10;

// Helper functions
const isSleepStep = (stepName: string) => {
  return stepName.includes('-sleep');
};

const calculateRowHeight = (index: number): number => {
  return index * (BAR_HEIGHT_PX + ROW_GAP_PX) + HEADER_HEIGHT_PX;
};

const calculateTimelineWidth = (
  leftPaneWidth: number,
  chartWidth: number
): number => {
  return leftPaneWidth + chartWidth;
};

const generateTimeMarkers = (totalDuration: number, chartWidth: number) => {
  return Array.from({ length: TIME_MARKER_COUNT }, (_, i) => {
    const timeOffset = (totalDuration * i) / (TIME_MARKER_COUNT - 1);
    return {
      label: `${(timeOffset / 1000).toFixed(1)}s`,
      position: (i / (TIME_MARKER_COUNT - 1)) * chartWidth,
    };
  });
};

const statusToColor = (
  status: Step['status'] | 'running' | 'completed' | 'paused' | 'active',
  isSleep: boolean = false,
  isHook: boolean = false
) => {
  // Sleep steps are always yellow
  if (isSleep) {
    return 'bg-yellow-500 border-yellow-600';
  }

  // Hooks are purple
  if (isHook) {
    return 'bg-purple-500 border-purple-600';
  }

  switch (status) {
    case 'running':
      return 'bg-blue-500 border-blue-600';
    case 'pending':
      return 'bg-blue-500 border-blue-600'; // Will add striped pattern
    case 'completed':
      return 'bg-green-500 border-green-600';
    case 'failed':
      return 'bg-red-500 border-red-600';
    case 'cancelled':
      return 'bg-orange-500 border-orange-600';
    case 'paused':
    case 'active':
      return 'bg-yellow-500 border-yellow-600';
    default:
      return 'bg-gray-400 border-gray-500';
  }
};

const getStripedClass = (item: TimelineItem) => {
  // Striped background for pending status or sleep steps
  if (item.status === 'pending' || item.type === 'sleep') {
    return 'bg-striped';
  }
  return '';
};

function TimelineBar({
  item,
  leftPx,
  widthPx,
  createdLeftPx,
  isSelected,
  isHovered,
  onClick,
  onHover,
}: {
  item: TimelineItem;
  leftPx: number;
  widthPx: number;
  createdLeftPx: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick?: () => void;
  onHover?: (itemId: string | null) => void;
}) {
  const isRunning = item.status === 'running' || item.isOngoing;
  const pendingDuration = item.startTime - item.createdTime;

  return (
    <button
      type="button"
      className="absolute inset-0"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={() => onHover?.(item.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={onClick}
      disabled={!onClick}
    >
      {/* Pending state indicator - only for run */}
      {item.type === 'run' && pendingDuration > 0 && (
        <>
          {/* Vertical line at createdAt */}
          <div
            className="absolute bg-gray-400 pointer-events-none"
            style={{
              left: `${createdLeftPx}px`,
              width: '2px',
              height: `${BAR_HEIGHT_PX}px`,
              top: 0,
            }}
          />
          {/* Horizontal line connecting to bar */}
          <div
            className="absolute bg-gray-400 pointer-events-none"
            style={{
              left: `${createdLeftPx}px`,
              width: `${leftPx - createdLeftPx}px`,
              height: '1px',
              top: `${BAR_HEIGHT_PX / 2}px`,
            }}
          />
        </>
      )}

      {/* Time indicators on hover */}
      {isHovered && (
        <>
          {/* Left time indicator */}
          <div
            className="absolute top-full mt-1 text-[8px] text-muted-foreground whitespace-nowrap pointer-events-none"
            style={{
              left: `${leftPx}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {new Date(item.startTime).toLocaleTimeString()}
          </div>
          {/* Right time indicator */}
          {widthPx > 40 && (
            <div
              className="absolute top-full mt-1 text-[8px] text-muted-foreground whitespace-nowrap pointer-events-none"
              style={{
                left: `${leftPx + widthPx}px`,
                transform: 'translateX(-50%)',
              }}
            >
              {new Date(item.endTime).toLocaleTimeString()}
            </div>
          )}
        </>
      )}

      {/* Main bar */}
      <div
        className={cn(
          'absolute rounded-sm border transition-all pointer-events-none',
          'flex items-center justify-center text-[10px] font-medium text-white',
          onClick &&
            'cursor-pointer hover:brightness-110 hover:scale-y-110 hover:z-10',
          !onClick && 'cursor-default',
          (isSelected || isHovered) && 'ring-2 ring-primary ring-offset-1 z-10',
          isRunning && 'animate-pulse',
          statusToColor(
            item.status,
            item.type === 'sleep',
            item.type === 'hook'
          ),
          getStripedClass(item)
        )}
        style={{
          left: `${leftPx}px`,
          width: `${widthPx}px`,
          height: `${BAR_HEIGHT_PX}px`,
          top: '0px',
        }}
      >
        {/* Show duration on bar if it's wide enough */}
        {widthPx > 60 && (
          <span className="text-[9px] text-black">
            {formatDuration(item.startTime, item.endTime)}
          </span>
        )}
        {widthPx <= 60 && item.isOngoing && (
          <span className="text-[8px]">●</span>
        )}
      </div>
    </button>
  );
}

/**
 * RunTraceView - A horizontally and vertically scrollable timeline visualization
 *
 * Architecture:
 * - Uses a single scrolling container for synchronized scrolling
 * - Step names are sticky positioned on the left, staying visible when scrolling horizontally
 * - Time markers are sticky positioned at the top, staying visible when scrolling vertically
 * - Timeline bars show the execution duration of each step, hook, and the run itself
 *
 * Defensive coding:
 * - All time calculations have minimum values to avoid division by zero
 * - Chart width is capped at 10000px to prevent extreme values
 * - Position calculations use Math.max(0, ...) to prevent negative values
 * - Load more button only shows if there's sufficient space (>20px)
 */
export function RunTraceView({
  steps,
  events,
  hooks,
  hasMore,
  onStepClick,
  onRunClick,
  onHookClick,
  onLoadMore,
  selectedStepId,
  runStartTime,
  runEndTime,
  runCreatedAt,
}: RunTraceViewProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  if (steps.length === 0 || !runStartTime) {
    return null;
  }

  const now = Date.now();
  const runCreated = runCreatedAt
    ? new Date(runCreatedAt).getTime()
    : new Date(runStartTime).getTime();
  const runStart = runStartTime ? new Date(runStartTime).getTime() : runCreated;
  const runEnd = runEndTime ? new Date(runEndTime).getTime() : now;
  const runIsOngoing = !runEndTime;
  const totalDuration = Math.max(1, runEnd - runCreated); // Minimum 1ms to avoid division by zero

  // Filter steps that have start times
  const stepsWithTimes = steps.filter((step) => step.startedAt);

  // Process events to create hook timeline items
  const hookCreatedEvents = events.filter(
    (e) => e.eventType === 'hook_created'
  );
  const hookDisposedEvents = events.filter(
    (e) => e.eventType === 'hook_disposed'
  );

  const hookItems: TimelineItem[] = hookCreatedEvents
    .filter((createdEvent) => createdEvent.correlationId)
    .map((createdEvent) => {
      const hookId = createdEvent.correlationId;
      const disposedEvent = hookDisposedEvents.find(
        (e) => e.correlationId === hookId
      );
      const hook = hooks.find((h) => h.hookId === hookId);

      const createdTime = new Date(createdEvent.createdAt).getTime();
      const endTime = disposedEvent
        ? new Date(disposedEvent.createdAt).getTime()
        : now;

      return {
        id: `hook-${hookId}`,
        type: 'hook',
        name: hook
          ? `Hook: ${hookId.substring(0, 8)}...`
          : `Hook ${hookId.substring(0, 8)}...`,
        status: disposedEvent ? 'completed' : 'active',
        createdTime,
        startTime: createdTime,
        endTime,
        isOngoing: !disposedEvent,
        hook,
        hookId,
      };
    });

  // Create timeline items: run + steps + hooks
  const items: TimelineItem[] = [
    {
      id: 'run',
      type: 'run',
      name: 'Run',
      status: runIsOngoing ? 'running' : 'completed',
      createdTime: runCreated,
      startTime: runStart,
      endTime: runEnd,
      isOngoing: runIsOngoing,
    },
    ...stepsWithTimes.map((step): TimelineItem => {
      const stepCreated = step.createdAt
        ? new Date(step.createdAt).getTime()
        : runCreated;
      const stepStart = step.startedAt
        ? new Date(step.startedAt).getTime()
        : stepCreated;
      const stepEnd = step.completedAt
        ? new Date(step.completedAt).getTime()
        : now;
      const stepIsOngoing = !step.completedAt && step.status === 'running';
      const isSleep = isSleepStep(step.stepName);

      return {
        id: step.stepId,
        type: isSleep ? 'sleep' : 'step',
        name: getResourceName(step.stepName),
        status: step.status,
        createdTime: stepCreated,
        startTime: stepStart,
        endTime: stepEnd,
        isOngoing: stepIsOngoing,
        step,
      };
    }),
    ...hookItems,
  ];

  // Create markers for hook_received and step_retrying events
  const markers: TimelineMarker[] = [];

  // Add hook_received markers
  events
    .filter((e) => e.eventType === 'hook_received' && e.correlationId)
    .forEach((event) => {
      const hookId = event.correlationId;
      if (!hookId) return;
      const hookItem = items.find((item) => item.hookId === hookId);
      if (hookItem) {
        markers.push({
          id: event.eventId,
          type: 'hook_received',
          itemId: hookItem.id,
          time: new Date(event.createdAt).getTime(),
          event,
        });
      }
    });

  // Add step_retrying markers
  events
    .filter((e) => e.eventType === 'step_retrying' && e.correlationId)
    .forEach((event) => {
      const stepId = event.correlationId;
      if (!stepId) return;
      const stepItem = items.find((item) => item.id === stepId);
      if (stepItem) {
        markers.push({
          id: event.eventId,
          type: 'step_retrying',
          itemId: stepItem.id,
          time: new Date(event.createdAt).getTime(),
          event,
        });
      }
    });

  // Calculate minimum width needed for the chart
  // Each item needs at least MIN_BAR_WIDTH_PX
  const rowCount = items.length;

  // Calculate the width needed to show all bars at minimum width
  // For this, we need to check the smallest duration and ensure it gets MIN_BAR_WIDTH_PX
  let chartWidthPx = 800; // default minimum width

  if (items.length > 0) {
    // Find the shortest duration as a percentage of total
    const shortestDurationPct = Math.min(
      ...items.map((item) => {
        const duration = Math.max(0, item.endTime - item.startTime);
        return Math.max(0.001, (duration / totalDuration) * 100); // Minimum 0.001% to avoid division by zero
      })
    );

    // Calculate width needed: if shortest bar is X% of total, and needs MIN_BAR_WIDTH_PX,
    // then total width = MIN_BAR_WIDTH_PX / (X / 100)
    const minRequiredWidth = MIN_BAR_WIDTH_PX / (shortestDurationPct / 100);
    chartWidthPx = Math.max(chartWidthPx, Math.min(minRequiredWidth, 10000)); // Cap at 10000px to avoid extreme widths
  }

  // Generate time indicators
  const timeMarkers = generateTimeMarkers(totalDuration, chartWidthPx);

  // Calculate dimensions
  const totalWidth = calculateTimelineWidth(LEFT_PANE_WIDTH_PX, chartWidthPx);
  const totalHeight = rowCount * (BAR_HEIGHT_PX + ROW_GAP_PX) + 40;

  return (
    <div>
      <style>{`
        .bg-striped {
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            rgba(255, 255, 255, 0.2) 4px,
            rgba(255, 255, 255, 0.2) 8px
          );
        }
      `}</style>
      <div className="text-sm text-muted-foreground mb-2">Timeline</div>
      {/* Single scrolling container */}
      <div
        className="relative bg-muted/20 rounded-lg border overflow-auto"
        style={
          {
            maxHeight: `${MAX_CHART_HEIGHT_PX}px`,
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
          } as React.CSSProperties
        }
      >
        <div
          className="relative"
          style={{
            width: `${totalWidth}px`,
            minWidth: '100%',
            height: `${totalHeight}px`,
          }}
        >
          {/* Time markers header - sticky */}
          <div
            className="sticky top-0 left-0 h-8 border-b border-border/50 bg-muted/20 z-10"
            style={{
              width: `${totalWidth}px`,
            }}
          >
            {/* Empty space for step names column */}
            <div
              className="absolute top-0 left-0 h-full bg-muted/20 border-r border-border/50"
              style={{
                width: `${LEFT_PANE_WIDTH_PX}px`,
              }}
            />
            {/* Time markers */}
            {timeMarkers.map((marker) => (
              <div
                key={`marker-${marker.position}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{
                  left: `${LEFT_PANE_WIDTH_PX + marker.position}px`,
                  top: '8px',
                  transform: 'translateX(-50%)',
                }}
              >
                {marker.label}
              </div>
            ))}
          </div>

          {/* Timeline rows */}
          {items.map((item, index) => {
            // Calculate positions and dimensions
            const createdOffset = Math.max(0, item.createdTime - runCreated);
            const startOffset = Math.max(0, item.startTime - runCreated);
            const duration = Math.max(0, item.endTime - item.startTime);

            const createdLeftPx =
              (createdOffset / totalDuration) * chartWidthPx;
            const leftPx = (startOffset / totalDuration) * chartWidthPx;
            const widthPx = Math.max(
              (duration / totalDuration) * chartWidthPx,
              MIN_BAR_WIDTH_PX
            );

            const topPx = calculateRowHeight(index);
            const isHighlighted =
              hoveredItemId === item.id || selectedStepId === item.id;
            const canClick = item.type === 'step' && item.step;

            return (
              <div
                key={item.id}
                className="absolute"
                style={{
                  top: `${topPx}px`,
                  left: 0,
                  width: `${totalWidth}px`,
                  height: `${BAR_HEIGHT_PX}px`,
                }}
              >
                {/* Sticky step name */}
                <button
                  type="button"
                  disabled={!canClick}
                  className={cn(
                    'px-2 py-1 text-xs text-left truncate transition-all rounded bg-muted/20 border-r border-border/50',
                    canClick && 'cursor-pointer hover:bg-muted',
                    !canClick && 'cursor-default',
                    isHighlighted && 'bg-primary/10 ring-1 ring-primary'
                  )}
                  style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    width: `${LEFT_PANE_WIDTH_PX}px`,
                    height: `${BAR_HEIGHT_PX}px`,
                    lineHeight: `${BAR_HEIGHT_PX - 8}px`,
                    zIndex: 5,
                  }}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  onClick={
                    canClick && item.step
                      ? () => {
                          if (item.step) {
                            onStepClick(item.step.stepId);
                          }
                        }
                      : item.type === 'run' && onRunClick
                        ? onRunClick
                        : item.type === 'hook' && item.hookId && onHookClick
                          ? () => {
                              if (item.hookId) {
                                onHookClick(item.hookId);
                              }
                            }
                          : undefined
                  }
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{item.name}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-md">
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
                          {item.type === 'hook' && (
                            <>
                              <div>Hook ID: {item.hookId}</div>
                              {item.hook && (
                                <>
                                  <div className="font-mono text-[10px] break-all">
                                    Token: {item.hook.token.substring(0, 20)}...
                                  </div>
                                  {item.hook.metadata && (
                                    <div>
                                      Metadata:{' '}
                                      {JSON.stringify(item.hook.metadata)}
                                    </div>
                                  )}
                                </>
                              )}
                              <div>
                                Status: {item.isOngoing ? 'Active' : 'Disposed'}
                              </div>
                            </>
                          )}
                          {item.type === 'run' && (
                            <>
                              <div>
                                Status:{' '}
                                {item.isOngoing ? 'Running' : 'Completed'}
                                {item.isOngoing && ' (ongoing)'}
                              </div>
                              {item.startTime - item.createdTime > 0 && (
                                <div>
                                  Time in pending state:{' '}
                                  {formatDuration(
                                    item.createdTime,
                                    item.startTime
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          <div>
                            Duration:{' '}
                            {formatDuration(item.startTime, item.endTime)}
                            {item.isOngoing && ' (so far)'}
                          </div>
                          <div>
                            Created:{' '}
                            {new Date(item.createdTime).toLocaleTimeString()}
                          </div>
                          {item.type !== 'hook' && (
                            <div>
                              Started:{' '}
                              {new Date(item.startTime).toLocaleTimeString()}
                            </div>
                          )}
                          {!item.isOngoing && (
                            <div>
                              {item.type === 'hook' ? 'Disposed' : 'Ended'}:{' '}
                              {new Date(item.endTime).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </button>

                {/* Timeline bar container */}
                <div
                  className="absolute top-0"
                  style={{
                    left: `${LEFT_PANE_WIDTH_PX}px`,
                    width: `${chartWidthPx}px`,
                    height: `${BAR_HEIGHT_PX}px`,
                    zIndex: 1,
                  }}
                >
                  <TimelineBar
                    item={item}
                    leftPx={leftPx}
                    widthPx={widthPx}
                    createdLeftPx={createdLeftPx}
                    isSelected={item.id === selectedStepId}
                    isHovered={hoveredItemId === item.id}
                    onClick={
                      item.type === 'step' && item.step
                        ? () => {
                            if (item.step) {
                              onStepClick(item.step.stepId);
                            }
                          }
                        : undefined
                    }
                    onHover={setHoveredItemId}
                  />

                  {/* Render markers for this item */}
                  {markers
                    .filter((marker) => marker.itemId === item.id)
                    .map((marker) => {
                      const markerOffset = Math.max(
                        0,
                        marker.time - runCreated
                      );
                      const markerLeftPx =
                        (markerOffset / totalDuration) * chartWidthPx;

                      return (
                        <Tooltip key={marker.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute pointer-events-auto cursor-pointer"
                              style={{
                                left: `${markerLeftPx}px`,
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 10,
                              }}
                            >
                              {marker.type === 'hook_received' && (
                                <Download className="w-3 h-3 text-green-600 bg-white rounded-full p-0.5 border border-green-600" />
                              )}
                              {marker.type === 'step_retrying' && (
                                <RefreshCw className="w-3 h-3 text-orange-600 bg-white rounded-full p-0.5 border border-orange-600" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <div className="font-semibold">
                                {marker.type === 'hook_received'
                                  ? 'Hook Received'
                                  : 'Step Retrying'}
                              </div>
                              <div>
                                Time:{' '}
                                {new Date(marker.time).toLocaleTimeString()}
                              </div>
                              {marker.type === 'step_retrying' &&
                                marker.event.eventType === 'step_retrying' &&
                                marker.event.eventData && (
                                  <div>
                                    Attempt: {marker.event.eventData.attempt}
                                  </div>
                                )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Load more indicator */}
          {hasMore &&
            onLoadMore &&
            items.length > 1 &&
            (() => {
              const lastStep = items[items.length - 1];
              const lastStepOffsetFromStart = Math.max(
                0,
                lastStep.endTime - runCreated
              );
              const lastStepEndPx =
                (lastStepOffsetFromStart / totalDuration) * chartWidthPx;
              const loadMoreLeft = LEFT_PANE_WIDTH_PX + lastStepEndPx + 8;
              const loadMoreWidth = Math.max(
                0,
                chartWidthPx - lastStepEndPx - 8
              );

              // Only show if there's enough space
              if (loadMoreWidth < 20) return null;

              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onLoadMore}
                      className="absolute bg-gray-400/30 hover:bg-gray-400/40 transition-colors cursor-pointer"
                      style={{
                        left: `${loadMoreLeft}px`,
                        top: `${HEADER_HEIGHT_PX}px`,
                        width: `${loadMoreWidth}px`,
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
      {/* Time labels */}
      <div className="flex justify-between text-xs text-muted-foreground pt-2">
        <span>{new Date(runCreated).toLocaleTimeString()}</span>
        <span>
          Duration: {formatDuration(runStartTime, runEndTime || now)}
          {runIsOngoing && ' (ongoing)'}
        </span>
        <span>
          {runIsOngoing ? 'Now' : new Date(runEnd).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
