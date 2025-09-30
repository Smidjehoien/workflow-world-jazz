// This file contains methods to fetch information about workflows and steps,
// by using the "world" API from the core package.

import {
  hydrateStepArguments,
  hydrateStepReturnValue,
  hydrateWorkflowArguments,
  hydrateWorkflowReturnValue,
} from '@vercel/workflow-core/serialization';
import type { Event, Step, WorkflowRun, World } from '@vercel/workflow-world';
import chalk from 'chalk';
import Table from 'easy-table';
import {
  logDebug,
  logInfo,
  logPlain,
  logWarn,
  showBox,
} from '../config/log.js';
import type { InspectCLIOptions } from '../config/types.js';
import { streamToConsole } from './stream.js';

class StreamID {
  constructor(public name: string | null) {}
  toString() {
    if (this.name === null) {
      return `strm_null`;
    }
    return chalk.green(this.name);
  }
  toJSON() {
    return this.name;
  }
}

const WORKFLOW_RUN_LISTED_PROPS: (keyof WorkflowRun)[] = [
  'runId',
  'workflowName',
  'status',
  'startedAt',
  'completedAt',
  'input',
  'output',
];

const STEP_LISTED_PROPS: (keyof Step)[] = [
  'runId',
  'stepId',
  'stepName',
  'status',
  'startedAt',
  'completedAt',
  'input',
  'output',
];

const EVENT_LISTED_PROPS: (keyof Event | 'eventData')[] = [
  'eventId',
  'eventType',
  'correlationId',
  'createdAt',
  'eventData',
];

const STATUS_COLORS: Record<
  WorkflowRun['status'] | Step['status'],
  (value: string) => string
> = {
  running: chalk.blue,
  completed: chalk.green,
  failed: chalk.red,
  cancelled: chalk.strikethrough.yellow,
  pending: chalk.blue,
  paused: chalk.yellow,
};

const showTable = (data: Record<string, unknown>[], props: string[]) => {
  // Add a blank line before any table
  const table = new Table();
  if (data && data.length === 0) {
    logWarn('No data found for this query and resource.\n');
    for (const prop of props) {
      table.cell(prop, 'N/A');
    }
    table.newRow();
    return table.toString();
  } else if (!data) {
    logWarn('Expecting an array of data, but got null.\n');
  }
  logPlain('');
  for (const item of data) {
    for (const prop of props) {
      const value = item[prop];
      if (value instanceof StreamID) {
        table.cell(prop, value.toString());
      } else if (prop === 'streamId') {
        table.cell(prop, chalk.green(value));
      } else if (prop === 'output' || prop === 'input') {
        table.cell(prop, inlineFormatIO(value));
      } else if (prop === 'status') {
        const status = value as WorkflowRun['status'] | Step['status'];
        const colorFunc = STATUS_COLORS[status];
        table.cell(prop, colorFunc(status));
      } else if (prop === 'eventData') {
        table.cell(prop, truncateString(JSON.stringify(value)));
      } else if (value instanceof Date) {
        table.cell(`${prop} (UTC)`, formatTableTimestamp(value));
      } else {
        table.cell(prop, value);
      }
    }
    table.newRow();
  }
  return table.toString();
};

const showJson = (data: unknown) => {
  const json = JSON.stringify(data, null, 2);
  process.stdout.write(`${json}\n`);
};

const getCursorHint = ({
  hasMore,
  cursor,
}: {
  hasMore: boolean;
  cursor: string | null;
}) => {
  if (hasMore && cursor) {
    return `More results available. Append\n--cursor ${cursor}\nto fetch the next page.`;
  }
};

/**
 * In tables, we want to show a shorter timestamp, YYYY-MM-DD HH:MM:SS
 */
const formatTableTimestamp = (value: Date) => {
  const isoValue = value.toISOString();
  return `${isoValue.split('T')[0]} ${isoValue.split('T')[1].split('.')[0]}`;
};

/**
 * This is an extra reviver for devalue that takes any streams that would be converted,
 * into actual streams, and instead formats them as string links for printing in CLI output.
 *
 * This is mainly because we don't want to open any streams that we aren't going to read from,
 * and so we can get the string ID/name, which the serializer stream doesn't provide.
 */
const streamPrintRevivers: Record<string, (value: any) => any> = {
  ReadableStream: (value: any) => {
    if ('name' in value) {
      return new StreamID(value.name);
    }
    return new StreamID(null);
  },
  WritableStream: (value: any) => {
    if ('name' in value) {
      return new StreamID(value.name);
    }
    return new StreamID(null);
  },
  TransformStream: (value: any) => {
    if ('name' in value) {
      return new StreamID(value.name);
    }
    return new StreamID(null);
  },
};

const hydrateWorkflowRunIO = (run: WorkflowRun): WorkflowRun => {
  return {
    ...run,
    input: run.input
      ? hydrateWorkflowArguments(run.input, globalThis, streamPrintRevivers)
      : run.input,
    output: run.output
      ? hydrateWorkflowReturnValue(
          run.output,
          [],
          globalThis,
          streamPrintRevivers
        )
      : run.output,
  };
};

const hydrateStepIO = (step: Step): Step => {
  return {
    ...step,
    input: step.input
      ? hydrateStepArguments(step.input, [], globalThis, streamPrintRevivers)
      : step.input,
    output: step.output
      ? hydrateStepReturnValue(step.output, globalThis, streamPrintRevivers)
      : step.output,
  };
};

const truncateString = (str: string, maxLength: number = 20) => {
  return str && str.length > maxLength
    ? `${str.substring(0, maxLength)}...`
    : str;
};

/**
 * Takes hydrated step/workflow input/output and serializes it for inline display.
 */
const inlineFormatIO = <T>(io: T): string => {
  const type = typeof io;
  let value = '';
  if (io === undefined) {
    value = '<empty>';
  } else if (io === null) {
    value = '<null>';
  } else if (io && Array.isArray(io)) {
    if (io.length === 0) {
      value = '<empty>';
    } else {
      value = io.map((item) => inlineFormatIO(item)).join(',');
    }
  } else if (type === 'object') {
    if (io instanceof StreamID) {
      value = io.toString();
    } else if (io instanceof Date) {
      value = `${formatTableTimestamp(io)}`;
    } else {
      value = truncateString(JSON.stringify(io));
    }
  } else if (['string', 'number', 'boolean'].includes(type)) {
    if (type === 'string' && (io as string).includes('strm_')) {
      value = io as string;
    }
    value = truncateString(String(io));
  } else {
    value = `<${type}>`;
  }
  return value;
};

export const listRuns = async (world: World, opts: InspectCLIOptions = {}) => {
  const runs = await world.runs.list({
    pagination: opts.cursor ? { cursor: opts.cursor } : undefined,
  });
  if (opts.stepId || opts.runId) {
    logWarn(
      'Filtering by step-id or run-id is not supported in list calls, ignoring filter.'
    );
  }
  if (opts.json) {
    showJson(runs);
    return;
  }
  const runsWithHydratedIO = runs.data.map((run) => hydrateWorkflowRunIO(run));
  showBox(
    'white',
    'INFO',
    'To view the input/output of a run, use `wf i run <run-id>`',
    'To view the content of any stream, use `wf i stream <stream-id>`',
    getCursorHint(runs)
  );
  logPlain(showTable(runsWithHydratedIO, WORKFLOW_RUN_LISTED_PROPS));
};

export const getRecentRunIds = async (world: World, limit: number = 10) => {
  logDebug(`No runId provided, fetching data for last ${limit} runs`);
  const runs = await world.runs.list({ pagination: { limit } });
  return runs.data.map((run) => run.runId);
};

export const showRun = async (
  world: World,
  runId: string,
  opts: InspectCLIOptions = {}
) => {
  const run = await world.runs.get(runId);
  const runWithHydratedIO = hydrateWorkflowRunIO(run);
  if (opts.json) {
    showJson(runWithHydratedIO);
    return;
  } else {
    logPlain(runWithHydratedIO);
  }
};

export const listSteps = async (
  world: World,
  opts: InspectCLIOptions = {
    runId: undefined,
  }
) => {
  if (opts.stepId) {
    logWarn(
      'Filtering by step-id is not supported in list calls, ignoring filter.'
    );
  }

  const runsIds = opts.runId ? [opts.runId] : await getRecentRunIds(world);

  logDebug(`Fetching steps for runs: ${runsIds.join(', ')}`);
  const stepChunks = await Promise.all(
    runsIds.map((runId) => world.steps.list({ runId }))
  );
  if (stepChunks.some((step) => step.hasMore)) {
    logInfo(
      'Showing partial results. Pagination is not supported for this command yet.'
    );
  }
  const steps = stepChunks.flatMap((step) => step.data);
  if (opts.json) {
    showJson(steps);
    return;
  }
  const stepsWithHydratedIO = steps.map((step) => hydrateStepIO(step));
  logPlain(showTable(stepsWithHydratedIO, STEP_LISTED_PROPS));
};

export const showStep = async (
  world: World,
  stepId: string,
  opts: InspectCLIOptions = {}
) => {
  if (opts.stepId) {
    logWarn(
      'Filtering by step-id is not supported in get calls, ignoring filter.'
    );
  }
  const step = await world.steps.get(opts.runId, stepId);
  const stepWithHydratedIO = hydrateStepIO(step);
  if (opts.json) {
    showJson(stepWithHydratedIO);
    return;
  } else {
    logPlain(stepWithHydratedIO);
  }
};

export const showStream = async (
  world: World,
  streamId: string,
  opts: InspectCLIOptions = {}
) => {
  if (opts.runId || opts.stepId) {
    logWarn(
      'Filtering by run-id or step-id is not supported in get calls, ignoring filter.'
    );
  }
  const stream = await world.readFromStream(streamId);
  logInfo('Streaming to stdout, press CTRL+C to abort.');
  logInfo(
    'Use --json to output the stream as newline-delimited JSON without info logs.\n'
  );
  await streamToConsole(stream, streamId, opts);
};

/**
 * Listing streams only lists available stream IDs based on run/step passed,
 * and doesn't read any data from the streams.
 */
export const listStreams = async (
  world: World,
  opts: InspectCLIOptions = {}
) => {
  const steps: Step[] = [];
  const runs: WorkflowRun[] = [];
  if (opts.stepId) {
    const step = await world.steps.get(undefined, opts.stepId);
    steps.push(step);
  } else if (opts.runId) {
    const run = await world.runs.get(opts.runId);
    runs.push(run);
    const runsSteps = await world.steps.list({
      runId: opts.runId,
      pagination: opts.cursor ? { cursor: opts.cursor } : undefined,
    });
    runsSteps.data.forEach((step: Step) => steps.push(step));
    logInfo(getCursorHint(runsSteps));
  } else {
    logWarn(
      'No run-id or step-id provided. Listing streams for latest run instead.',
      'Use --run=<run-id> or --step=<step-id> to filter streams by run or step.'
    );
    const run = await world.runs.list({ pagination: { limit: 1 } });
    if (!run.data.length) {
      logWarn('No runs found.');
      return;
    }
    runs.push(run.data[0]);
    const runsSteps = await world.steps.list({
      runId: runs[0].runId,
      pagination: opts.cursor ? { cursor: opts.cursor } : undefined,
    });
    runsSteps.data.forEach((step: Step) => steps.push(step));
    logInfo(getCursorHint(runsSteps));
  }

  const runIds = runs.map((item) => item.runId);
  const stepIds = steps.map((item) => item.stepId);
  logDebug(`Found IO for runs/steps: ${runIds.concat(stepIds).join(', ')}`);

  // We need to hydrate IO for all the runs and steps to find stream IDs
  const runsWithHydratedIO = runs.map((run) => hydrateWorkflowRunIO(run));
  const stepsWithHydratedIO = steps.map((step) => hydrateStepIO(step));

  const matchingStreams = [
    ...runsWithHydratedIO,
    ...stepsWithHydratedIO,
  ].flatMap((item) =>
    findAllStreamIdsForObjectWithIO({
      input: item.input,
      output: item.output,
      runId: item.runId,
      stepId: 'stepId' in item ? item.stepId : undefined,
    })
  );

  if (opts.json) {
    showJson(matchingStreams);
    return;
  }
  logPlain(showTable(matchingStreams, ['runId', 'stepId', 'streamId']));
};

const findAllStreamIdsForObjectWithIO = (obj: {
  input: any;
  output: any;
  runId?: string;
  stepId?: string;
}): {
  runId?: string;
  stepId?: string;
  streamId: string;
}[] => {
  const matchingStreams: {
    runId?: string;
    stepId?: string;
    streamId: string;
  }[] = [];
  const objectKeys = ['input', 'output'] as (keyof typeof obj)[];
  for (const key of objectKeys) {
    for (const item of obj[key]) {
      const value = item[key];
      if (!value) continue;
      const streamIds = getStreamIdsFromHydratedObject(value);
      for (const streamId of streamIds) {
        matchingStreams.push({
          runId: item.runId,
          stepId: item.stepId || '/',
          streamId,
        });
      }
    }
  }
  return matchingStreams;
};

const getStreamIdsFromHydratedObject = (io: any): string[] => {
  const streamIds: string[] = [];
  const traverse = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return;
    if (obj instanceof StreamID) {
      streamIds.push(obj.toString());
    } else if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else {
      Object.values(obj).forEach(traverse);
    }
  };

  traverse(io);
  return streamIds;
};

export const listEvents = async (
  world: World,
  opts: InspectCLIOptions = {}
) => {
  if (opts.stepId) {
    // TODO: Once we can fetch a run ID from a step ID, we can then query
    // by run and filter back down to step here.
    logWarn(
      'Filtering by step-id is not supported in list calls yet, ignoring filter.'
    );
  }
  const runsIds = opts.runId ? [opts.runId] : await getRecentRunIds(world);
  logDebug(`Fetching events for runs: ${runsIds.join(', ')}`);
  const events = await Promise.all(
    runsIds.map((runId) => world.events.list({ runId }))
  );
  const allEvents = events.flatMap((event) => event.data);
  if (opts.json) {
    showJson(allEvents);
    return;
  }
  logPlain(showTable(allEvents, EVENT_LISTED_PROPS));
};
