'use server';

import {
  extractStreamIds,
  hydrateResourceIO,
} from '@vercel/workflow-core/observability';
import type { Step } from '@vercel/workflow-world';
import { setupWorld, type WorldConfig } from './config-world';
import { DEFAULT_PAGE_SIZE } from './utils';

export async function getStepStreams(step: Step) {
  'use server';
  const streamIds = new Set<string>();
  extractStreamIds(step.input).forEach((id) => {
    streamIds.add(id);
  });
  extractStreamIds(step.output).forEach((id) => {
    streamIds.add(id);
  });
  const streamList = Array.from(streamIds);
  return streamList;
}

export async function fetchRuns(
  config: WorldConfig,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = DEFAULT_PAGE_SIZE
) {
  const world = await setupWorld(config);
  const runs = await world.runs.list({
    pagination: { cursor, limit, sortOrder },
    resolveData: 'none', // List views don't need full data
  });
  runs.data = runs.data.map(hydrateResourceIO);
  return runs;
}

export async function fetchRun(config: WorldConfig, runId: string) {
  const world = await setupWorld(config);
  const run = await world.runs.get(runId, { resolveData: 'all' });

  // Hydrate input/output with custom revivers that preserve stream IDs
  return hydrateResourceIO(run);
}

export async function fetchSteps(
  config: WorldConfig,
  runId: string,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'asc',
  limit: number = DEFAULT_PAGE_SIZE
) {
  const world = await setupWorld(config);
  const steps = await world.steps.list({
    runId,
    pagination: { cursor, limit, sortOrder },
    resolveData: 'none', // List views don't need full data
  });
  return steps;
}

export async function fetchStep(
  config: WorldConfig,
  runId: string | undefined,
  stepId: string
) {
  const world = await setupWorld(config);
  const step = await world.steps.get(runId, stepId, { resolveData: 'all' });
  return {
    ...hydrateResourceIO(step),
    streamIds: await getStepStreams(step),
  };
}

export async function fetchEvents(
  config: WorldConfig,
  runId: string,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = DEFAULT_PAGE_SIZE,
  // List views don't need full data by default, but if we use this
  // to re-fetch data for events in detail, we need to set this to true.
  // This is because the world doesn't have a function to get a single event.
  withData: boolean = false
) {
  const world = await setupWorld(config);
  const events = await world.events.list({
    runId,
    pagination: { cursor, limit, sortOrder },
    resolveData: withData ? 'all' : 'none',
  });
  return events;
}

export async function readStream(
  config: WorldConfig,
  streamId: string,
  startIndex?: number
): Promise<ReadableStream<Uint8Array>> {
  const world = await setupWorld(config);
  return world.readFromStream(streamId, startIndex);
}

export async function fetchHooks(
  config: WorldConfig,
  runId?: string,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = DEFAULT_PAGE_SIZE
) {
  const world = await setupWorld(config);
  const hooks = await world.hooks.list({
    runId,
    pagination: { cursor, limit, sortOrder },
    resolveData: 'none', // List views don't need full data
  });
  hooks.data = hooks.data.map(hydrateResourceIO);
  return hooks;
}

export async function fetchHook(config: WorldConfig, hookId: string) {
  const world = await setupWorld(config);
  const hook = await world.hooks.get(hookId, { resolveData: 'all' });
  return hydrateResourceIO(hook);
}

export async function fetchEventsByCorrelationId(
  config: WorldConfig,
  correlationId: string,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'asc',
  limit: number = 100
) {
  const world = await setupWorld(config);
  const events = await world.events.listByCorrelationId({
    correlationId,
    pagination: { cursor, limit, sortOrder },
    resolveData: 'none',
  });
  return events;
}
