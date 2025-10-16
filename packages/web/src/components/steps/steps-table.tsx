'use client';

import type { Event, Hook, Step } from '@vercel/workflow-world';
import { getResourceName } from '@/lib/resource-name';
import type { ColumnDefinition } from '../display-utils/local-paginating-table';
import { LocalPaginatingTable } from '../display-utils/local-paginating-table';
import { RelativeTime } from '../display-utils/relative-time';
import { StatusBadge } from '../display-utils/status-badge';
import { RunTraceView } from './run-trace-view';
import { RunTraceViewLoadingSkeleton } from './run-trace-view-skeleton';

interface StepsTableProps {
  steps: Step[];
  events: Event[];
  hooks: Hook[];
  loading: boolean;
  error?: Error;
  hasHitLimit: boolean;
  initialLoadComplete: boolean;
  onStepClick: (stepId: string) => void;
  onRunClick?: () => void;
  onHookClick?: (hookId: string) => void;
  selectedStepId?: string;
  runStartTime?: string;
  runEndTime?: string;
  runCreatedAt?: string;
}

/**
 * StepsTable - Displays steps with local pagination.
 * Receives pre-fetched steps, events, and hooks data from parent component.
 */
export function StepsTable({
  steps,
  events,
  hooks,
  loading,
  error,
  hasHitLimit,
  initialLoadComplete,
  onStepClick,
  onRunClick,
  onHookClick,
  selectedStepId,
  runStartTime,
  runEndTime,
  runCreatedAt,
}: StepsTableProps) {
  // Define table columns
  const columns: ColumnDefinition<Step>[] = [
    {
      key: 'stepId',
      header: 'Step ID',
      render: (step) => (
        <span className="font-mono text-xs">{step.stepId}</span>
      ),
    },
    {
      key: 'stepName',
      header: 'Step Name',
      render: (step) => getResourceName(step.stepName),
    },
    {
      key: 'status',
      header: 'Status',
      render: (step) => <StatusBadge status={step.status} context={step} />,
    },
    {
      key: 'startedAt',
      header: 'Started',
      render: (step) =>
        step.startedAt ? <RelativeTime date={step.startedAt} /> : '-',
    },
    {
      key: 'completedAt',
      header: 'Completed',
      render: (step) =>
        step.completedAt ? <RelativeTime date={step.completedAt} /> : '-',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Timeline Chart */}
      <div className="bg-card rounded-lg border p-6">
        {loading && !initialLoadComplete ? (
          <RunTraceViewLoadingSkeleton />
        ) : (
          <RunTraceView
            steps={steps}
            events={events}
            hooks={hooks}
            hasMore={false} // We fetch all steps exhaustively
            onStepClick={onStepClick}
            selectedStepId={selectedStepId}
            runStartTime={runStartTime}
            runEndTime={runEndTime}
            runCreatedAt={runCreatedAt}
            onRunClick={onRunClick}
            onHookClick={onHookClick}
          />
        )}
      </div>

      {/* Steps Table */}
      <LocalPaginatingTable
        items={steps}
        columns={columns}
        title="Steps"
        loading={loading && !initialLoadComplete}
        error={error}
        getItemKey={(step) => step.stepId}
        onRowClick={(step) => onStepClick(step.stepId)}
        isRowSelected={(step) => step.stepId === selectedStepId}
        emptyMessage="No steps found"
        warningMessage={
          hasHitLimit
            ? 'Showing first 1000 steps only. There may be more steps that are not displayed.'
            : undefined
        }
      />
    </div>
  );
}
