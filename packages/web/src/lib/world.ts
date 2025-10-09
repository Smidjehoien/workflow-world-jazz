'use server';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getWorld, resetWorld } from '@vercel/workflow-core';
import {
  hydrateStepArguments,
  hydrateStepReturnValue,
  hydrateWorkflowArguments,
  hydrateWorkflowReturnValue,
} from '@vercel/workflow-core/serialization';
import type { SearchParams } from 'next/dist/server/request/search-params';

const DEFAULT_PAGE_SIZE = 10;

export interface WorldConfig {
  backend?: string;
  env?: string;
  authToken?: string;
  project?: string;
  team?: string;
  port?: string;
  dataDir?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Validate configuration and return errors if any
export async function validateWorldConfig(
  config: WorldConfig
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const backend = config.backend || 'embedded';

  if (backend === 'embedded') {
    // Check if data directory exists
    if (config.dataDir) {
      const resolvedPath = resolve(config.dataDir);
      if (!existsSync(resolvedPath)) {
        errors.push({
          field: 'dataDir',
          message: `Data directory does not exist: ${resolvedPath}`,
        });
      }
    }

    // Validate port if provided
    if (config.port) {
      const portNum = Number.parseInt(config.port, 10);
      if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.push({
          field: 'port',
          message: 'Port must be a number between 1 and 65535',
        });
      }
    }
  }

  return errors;
}

export const getDefaultWorldConfig = async (
  params: SearchParams
): Promise<WorldConfig> => {
  const config: WorldConfig = {
    backend: 'embedded',
    dataDir: '../../workbench/nextjs-turbopack/.next/workflow-data',
    port: '3000',
    env: 'production',
  };

  // Convert search params to config object
  for (const [key, value] of Object.entries(params)) {
    if (value && !Array.isArray(value)) {
      config[key as keyof WorldConfig] = value;
    }
  }

  return config;
};

// Set up environment variables from config
export async function setupWorld(config: WorldConfig) {
  // Validate first
  const errors = await validateWorldConfig(config);
  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`
    );
  }

  const backend = config.backend || 'embedded';

  // Reset the cached world instance before changing env vars
  resetWorld();

  // Set env vars
  process.env.WORKFLOW_TARGET_WORLD = backend;

  if (backend === 'embedded') {
    // Use provided config or fall back to default for localhost dev setup
    if (config.dataDir) {
      process.env.WORKFLOW_EMBEDDED_DATA_DIR = config.dataDir;
    }

    if (config.port) {
      process.env.PORT = config.port;
    }
  } else if (backend === 'vercel') {
    if (config.env) {
      process.env.WORKFLOW_VERCEL_ENV = config.env;
    }
    if (config.authToken) {
      process.env.WORKFLOW_VERCEL_AUTH_TOKEN = config.authToken;
    }
    if (config.project) {
      process.env.WORKFLOW_VERCEL_PROJECT_ID = config.project;
    }
    if (config.team) {
      process.env.WORKFLOW_VERCEL_TEAM_ID = config.team;
    }
    process.env.WORKFLOW_VERCEL_PROXY_URL =
      'https://api.vercel.com/v1/workflow';
  }

  return getWorld();
}

// Custom revivers that preserve stream names as string IDs for display
const streamDisplayRevivers: Record<string, (value: any) => any> = {
  ReadableStream: (value: any) => {
    if ('name' in value) {
      return value.name;
    }
    return value;
  },
  WritableStream: (value: any) => {
    if ('name' in value) {
      return value.name;
    }
    return value;
  },
};

export async function fetchRuns(
  config: WorldConfig,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = DEFAULT_PAGE_SIZE
) {
  const world = await setupWorld(config);
  const runs = await world.runs.list({
    pagination: { cursor, limit, sortOrder },
  });
  return runs;
}

export async function fetchRun(config: WorldConfig, runId: string) {
  const world = await setupWorld(config);
  const run = await world.runs.get(runId);

  // Hydrate input/output with custom revivers that preserve stream IDs
  return {
    ...run,
    input: run.input
      ? hydrateWorkflowArguments(run.input, globalThis, streamDisplayRevivers)
      : run.input,
    output: run.output
      ? hydrateWorkflowReturnValue(
          run.output,
          [],
          globalThis,
          streamDisplayRevivers
        )
      : run.output,
  };
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
  });
  return steps;
}

export async function fetchStep(
  config: WorldConfig,
  runId: string | undefined,
  stepId: string
) {
  const world = await setupWorld(config);
  const step = await world.steps.get(runId, stepId);

  // Hydrate input/output with custom revivers that preserve stream IDs
  return {
    ...step,
    input: step.input
      ? hydrateStepArguments(step.input, [], globalThis, streamDisplayRevivers)
      : step.input,
    output: step.output
      ? hydrateStepReturnValue(step.output, globalThis, streamDisplayRevivers)
      : step.output,
  };
}

export async function fetchEvents(
  config: WorldConfig,
  runId: string,
  cursor?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = DEFAULT_PAGE_SIZE
) {
  const world = await setupWorld(config);
  const events = await world.events.list({
    runId,
    pagination: { cursor, limit, sortOrder },
  });
  return events;
}

export async function fetchEvent(
  config: WorldConfig,
  runId: string,
  eventId: string
) {
  const world = await setupWorld(config);
  // For now, we need to get it from list since there's no direct get
  // This is a limitation - in a real implementation, you'd want a direct get method
  const events = await world.events.list({
    runId,
    pagination: { limit: DEFAULT_PAGE_SIZE, sortOrder: 'desc' },
  });

  const event = events.data.find((e) => e.eventId === eventId);
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  return event;
}

export async function readStream(
  config: WorldConfig,
  streamId: string,
  startIndex?: number
): Promise<ReadableStream<Uint8Array>> {
  const world = await setupWorld(config);
  return world.readFromStream(streamId, startIndex);
}
