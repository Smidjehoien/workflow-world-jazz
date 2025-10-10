import type { Event, Step, WorkflowRun } from '@vercel/workflow-world';
import useSWR from 'swr';
import { DEFAULT_PAGE_SIZE } from '@/lib/utils';
import {
  fetchEvents,
  fetchRun,
  fetchRuns,
  fetchStep,
  fetchSteps,
  type WorldConfig,
} from '@/lib/world';
import { usePaginatedQuery } from './use-paginated-query';

// Helper to create a stable cache key
export function createAPICallKey(
  config: WorldConfig,
  ...parts: (string | undefined)[]
) {
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
    createAPICallKey(config, 'run', runId),
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
    stepId ? createAPICallKey(config, 'step', runId, stepId) : null,
    () => fetchStep(config, runId, stepId),
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
      createAPICallKey(
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
  limit: number = DEFAULT_PAGE_SIZE
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
      createAPICallKey(
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

export const createEventKey = (
  params: {
    config: WorldConfig;
    runId: string;
    sortOrder: 'asc' | 'desc';
    limit: number;
  },
  cursor?: string
) => {
  return createAPICallKey(
    params.config,
    'events',
    params.runId,
    cursor,
    params.sortOrder,
    String(params.limit)
  );
};

// Paginated events hook
export function useEvents(
  config: WorldConfig,
  runId: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = DEFAULT_PAGE_SIZE
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
    createKey: (params, cursor) => createEventKey(params, cursor),
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
