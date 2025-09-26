// This file contains methods to fetch information about workflows and steps,
// by using the "world" API from the core package.

import type {
  Event,
  Step,
  WorkflowRun,
  World,
} from '@vercel/workflow-core/runtime';
import {
  hydrateStepArguments,
  hydrateStepReturnValue,
  hydrateWorkflowArguments,
  hydrateWorkflowReturnValue,
} from '@vercel/workflow-core/serialization';
import Table from 'easy-table';
import { logInfo, logPlain } from '../config/log.js';

type JsonFlag = { json?: boolean };

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

const showTable = (data: Record<string, unknown>[], props: string[]) => {
  const table = new Table();
  for (const item of data) {
    for (const prop of props) {
      const value = item[prop];
      if (value instanceof Date) {
        table.cell(`${prop} (UTC)`, formatTableTimestamp(value));
      } else {
        table.cell(prop, value);
      }
    }
    table.newRow();
  }
  if (data.length === 0) {
    for (const prop of props) {
      table.cell(prop, 'N/A');
    }
  }
  return table.toString();
};

const showJson = (data: unknown) => {
  const json = JSON.stringify(data, null, 2);
  process.stdout.write(`${json}\n`);
};

const showCursorInfo = ({
  cursor,
  hasMore,
}: {
  cursor: string | null;
  hasMore: boolean;
}) => {
  if (cursor) {
    // TODO: Once we add pagination, we should show human-readable
    // information
    // logInfo(`Cursor: ${cursor}`);
  }
  if (hasMore) {
    logInfo(`(showing partial list, pagination is coming soon)`);
  }
};

/**
 * In tables, we want to show a shorter timestamp, YYYY-MM-DD HH:MM:SS
 */
const formatTableTimestamp = (value: Date) => {
  const isoValue = value.toISOString();
  return `${isoValue.split('T')[0]} ${isoValue.split('T')[1].split('.')[0]}`;
};

export const listRuns = async (world: World, opts: JsonFlag = {}) => {
  const runs = await world.runs.list({});
  if (opts.json) {
    showJson(runs);
    return;
  }
  logPlain(showTable(runs.data, WORKFLOW_RUN_LISTED_PROPS));
  showCursorInfo({ cursor: runs.cursor, hasMore: runs.hasMore });
};

export const showRun = async (
  world: World,
  runId: string,
  opts: JsonFlag = {}
) => {
  const run = await world.runs.get(runId);
  if (run.input) {
    const input = hydrateWorkflowArguments(run.input, []);
    run.input = input;
  }
  if (run.output) {
    const output = hydrateWorkflowReturnValue(run.output, []);
    run.output = output;
  }
  if (opts.json) {
    showJson(run);
    return;
  } else {
    logPlain(run);
  }
};

export const listSteps = async (
  world: World,
  runId: string,
  opts: JsonFlag = {}
) => {
  const steps = await world.steps.list({ runId });
  if (opts.json) {
    showJson(steps);
    return;
  }
  showCursorInfo({ cursor: steps.cursor, hasMore: steps.hasMore });
  logPlain(showTable(steps.data, STEP_LISTED_PROPS));
};

export const showStep = async (
  world: World,
  runId: string,
  stepId: string,
  opts: JsonFlag = {}
) => {
  const step = await world.steps.get(runId, stepId);
  if (step.input) {
    const input = hydrateStepArguments(step.input, []);
    step.input = input;
  }
  if (step.output) {
    const output = hydrateStepReturnValue(step.output, []);
    step.output = output;
  }
  if (opts.json) {
    showJson(step);
    return;
  } else {
    logPlain(step);
  }
};

export const printStream = async (
  world: World,
  runId: string,
  opts: JsonFlag = {}
) => {
  // There is a single implicit output stream per workflow run,
  // whose stream name is the runId itself.
  const stream = await world.readFromStream(runId, 0);
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (opts.json) {
        const text = Buffer.from(value).toString('utf8');
        const json = JSON.stringify({ chunk: text });
        process.stdout.write(`${json}\n`);
      } else {
        process.stdout.write(Buffer.from(value));
      }
    }
  } catch (err) {
    if (opts.json) {
      const json = JSON.stringify({
        error: `Failed to read stream for run ${runId}`,
        details: String(err),
      });
      process.stderr.write(`${json}\n`);
    } else {
      console.error(`Failed to read stream for run ${runId}:`, err);
    }
  } finally {
    try {
      reader.cancel();
    } catch {
      // Ignore cancellation errors during cleanup
    }
  }
};

export const listEvents = async (
  world: World,
  runId: string,
  opts: JsonFlag = {}
) => {
  const events = await world.events.list({ runId });
  if (opts.json) {
    showJson(events.data);
    return;
  }
  showCursorInfo({ cursor: events.cursor, hasMore: events.hasMore });
  logPlain(showTable(events.data, EVENT_LISTED_PROPS));
};
