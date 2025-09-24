// This file contains methods to fetch information about workflows and steps,
// by using the "world" API from the core package.

import type { Event, Step, WorkflowRun } from '@vercel/workflow-core/runtime';
import Table from 'easy-table';
import { getWorld } from './world.js';

const WORKFLOW_RUN_LISTED_PROPS: (keyof WorkflowRun)[] = [
  'runId',
  'workflowName',
  'status',
  'startedAt',
  'completedAt',
];

const STEP_LISTED_PROPS: (keyof Step)[] = [
  'runId',
  'stepId',
  'stepName',
  'status',
  'startedAt',
  'completedAt',
];

const EVENT_LISTED_PROPS: (keyof Event)[] = [
  'eventId',
  'eventType',
  'correlationId',
  'createdAt',
];

/**
 * In tables, we want to show a shorter timestamp, YYYY-MM-DD HH:MM:SS
 */
const formatTableTimestamp = (value: Date) => {
  const isoValue = value.toISOString();
  return isoValue.split('T')[0] + ' ' + isoValue.split('T')[1].split('.')[0];
};

export const listRuns = async () => {
  const world = await getWorld();
  const runs = await world.runs.list({});
  if (!runs?.data?.length) {
    console.log('No runs found.');
  }
  if (runs.cursor) {
    console.log(`Cursor: ${runs.cursor}`);
  }
  if (runs.hasMore) {
    console.log(`Showing partial list`);
  }

  const table = new Table();
  for (const run of runs.data) {
    for (const prop of WORKFLOW_RUN_LISTED_PROPS) {
      const value = run[prop];
      if (value instanceof Date) {
        table.cell(prop, formatTableTimestamp(value));
      } else {
        table.cell(prop, value);
      }
    }
    table.newRow();
  }
  console.log(table.toString());
};

export const showRun = async (runId: string) => {
  const world = await getWorld();
  const run = await world.runs.get(runId);
  console.log(run);
};

export const listSteps = async (runId: string) => {
  const world = await getWorld();
  const steps = await world.steps.list({ runId });
  if (!steps?.data?.length) {
    console.log('No steps found.');
  }
  if (steps.cursor) {
    console.log(`Cursor: ${steps.cursor}`);
  }
  if (steps.hasMore) {
    console.log(`Showing partial list`);
  }

  const table = new Table();
  for (const run of steps.data) {
    for (const prop of STEP_LISTED_PROPS) {
      const value = run[prop];
      if (value instanceof Date) {
        table.cell(prop, formatTableTimestamp(value));
      } else {
        table.cell(prop, value);
      }
    }
    table.newRow();
  }
  console.log(table.toString());
};

export const showStep = async (runId: string, stepId: string) => {
  const world = await getWorld();
  const step = await world.steps.get(runId, stepId);
  console.log(step);
};

export const printStream = async (runId: string) => {
  const world = await getWorld();
  // There is a single implicit output stream per workflow run,
  // whose stream name is the runId itself.
  const stream = await world.readFromStream(runId, 0);
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      process.stdout.write(Buffer.from(value));
    }
  } catch (err) {
    console.error(`Failed to read stream for run ${runId}:`, err);
  }
};

export const listEvents = async (runId: string) => {
  const world = await getWorld();
  const events = await world.events.list({ runId });
  if (!events?.data?.length) {
    console.log('No events found.');
  }
  if (events.cursor) {
    console.log(`Cursor: ${events.cursor}`);
  }
  if (events.hasMore) {
    console.log(`Showing partial list`);
  }

  const table = new Table();
  for (const event of events.data) {
    for (const prop of EVENT_LISTED_PROPS) {
      const value = event[prop];
      if (value instanceof Date) {
        table.cell(prop, formatTableTimestamp(value));
      } else {
        table.cell(prop, value);
      }
    }
    table.newRow();
  }
  console.log(table.toString());
};
