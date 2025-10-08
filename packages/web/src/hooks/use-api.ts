import {
  fetchEvent,
  fetchEvents,
  fetchRun,
  fetchRuns,
  fetchStep,
  fetchSteps,
  type WorldConfig,
} from '@/lib/world';
import type { Event, Step, WorkflowRun } from '@vercel/workflow-world';
import useSWR from 'swr';
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
  options?: { refreshInterval?: number }
) {
  return usePaginatedQuery<WorkflowRun, WorldConfig>({
    createKey: (params, cursor) => createKey(params, 'runs', cursor),
    fetcher: (params, cursor) => fetchRuns(params, cursor),
    params: config,
    refreshInterval: options?.refreshInterval,
  });
}

// Paginated steps hook
export function useSteps(config: WorldConfig, runId: string) {
  return usePaginatedQuery<Step, { config: WorldConfig; runId: string }>({
    createKey: (params, cursor) =>
      createKey(params.config, 'steps', params.runId, cursor),
    fetcher: (params, cursor) =>
      fetchSteps(params.config, params.runId, cursor),
    params: { config, runId },
  });
}

// Paginated events hook
export function useEvents(config: WorldConfig, runId: string) {
  return usePaginatedQuery<Event, { config: WorldConfig; runId: string }>({
    createKey: (params, cursor) =>
      createKey(params.config, 'events', params.runId, cursor),
    fetcher: (params, cursor) =>
      fetchEvents(params.config, params.runId, cursor),
    params: { config, runId },
  });
}
