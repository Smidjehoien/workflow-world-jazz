import type { Event, Step, WorkflowRun } from '@vercel/workflow-world';
import useSWR from 'swr';
import {
  fetchEvent,
  fetchEvents,
  fetchRun,
  fetchRuns,
  fetchStep,
  fetchSteps,
  type WorldConfig,
} from '@/lib/world';
import { usePaginatedQuery } from './use-paginated-query';

// Helper to create a stable cache key
function createKey(config: WorldConfig, ...parts: (string | undefined)[]) {
  const configKey = JSON.stringify(config);
  return [configKey, ...parts].filter(Boolean).join('::');
}

// Single run hook with auto-refresh option
export function useRun(
  config: WorldConfig,
  runId: string,
  options?: { refreshInterval?: number }
) {
  return useSWR(
    createKey(config, 'run', runId),
    () => fetchRun(config, runId),
    {
      refreshInterval: options?.refreshInterval,
      revalidateOnFocus: false,
    }
  );
}

// Single step hook
export function useStep(
  config: WorldConfig,
  runId: string | undefined,
  stepId: string
) {
  return useSWR(
    stepId ? createKey(config, 'step', runId, stepId) : null,
    () => fetchStep(config, runId, stepId),
    {
      revalidateOnFocus: false,
    }
  );
}

// Single event hook
export function useEvent(config: WorldConfig, runId: string, eventId: string) {
  return useSWR(
    eventId ? createKey(config, 'event', runId, eventId) : null,
    () => fetchEvent(config, runId, eventId),
    {
      revalidateOnFocus: false,
    }
  );
}

// Paginated runs hook
export function useRuns(
  config: WorldConfig,
  options?: {
    refreshInterval?: number;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  }
) {
  const sortOrder = options?.sortOrder || 'desc';
  const limit = options?.limit || 10;
  return usePaginatedQuery<
    WorkflowRun,
    { config: WorldConfig; sortOrder: 'asc' | 'desc'; limit: number }
  >({
    createKey: (params, cursor) =>
      createKey(
        params.config,
        'runs',
        cursor,
        params.sortOrder,
        String(params.limit)
      ),
    fetcher: (params, cursor) =>
      fetchRuns(params.config, cursor, params.sortOrder, params.limit),
    params: { config, sortOrder, limit },
    refreshInterval: options?.refreshInterval,
  });
}

// Paginated steps hook
export function useSteps(
  config: WorldConfig,
  runId: string,
  sortOrder: 'asc' | 'desc' = 'asc',
  limit: number = 10
) {
  return usePaginatedQuery<
    Step,
    {
      config: WorldConfig;
      runId: string;
      sortOrder: 'asc' | 'desc';
      limit: number;
    }
  >({
    createKey: (params, cursor) =>
      createKey(
        params.config,
        'steps',
        params.runId,
        cursor,
        params.sortOrder,
        String(params.limit)
      ),
    fetcher: (params, cursor) =>
      fetchSteps(
        params.config,
        params.runId,
        cursor,
        params.sortOrder,
        params.limit
      ),
    params: { config, runId, sortOrder, limit },
  });
}

// Paginated events hook
export function useEvents(
  config: WorldConfig,
  runId: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = 10
) {
  return usePaginatedQuery<
    Event,
    {
      config: WorldConfig;
      runId: string;
      sortOrder: 'asc' | 'desc';
      limit: number;
    }
  >({
    createKey: (params, cursor) =>
      createKey(
        params.config,
        'events',
        params.runId,
        cursor,
        params.sortOrder,
        String(params.limit)
      ),
    fetcher: (params, cursor) =>
      fetchEvents(
        params.config,
        params.runId,
        cursor,
        params.sortOrder,
        params.limit
      ),
    params: { config, runId, sortOrder, limit },
  });
}
