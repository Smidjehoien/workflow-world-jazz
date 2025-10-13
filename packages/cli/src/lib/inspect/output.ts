// This file contains methods to fetch information about workflows and steps,
// by using the "world" API from the core package.

import {
  hydrateResourceIO,
  StreamID,
} from '@vercel/workflow-core/observability';
import type { Event, Step, WorkflowRun, World } from '@vercel/workflow-world';
import chalk from 'chalk';
import { formatDistance } from 'date-fns';
import Table from 'easy-table';
import { logger } from '../config/log.js';
import type { InspectCLIOptions } from '../config/types.js';
import { getWorkflowReadableStream } from '../runtime.js';
import { streamToConsole } from './stream.js';

const DEFAULT_PAGE_SIZE = 20;
const TABLE_TRUNCATE_IO_LENGTH = 15;

const WORKFLOW_RUN_IO_PROPS: (keyof WorkflowRun)[] = ['input', 'output'];

const STEP_IO_PROPS: (keyof Step)[] = ['input', 'output'];

const WORKFLOW_RUN_LISTED_PROPS: (keyof WorkflowRun)[] = [
  'runId',
  'workflowName',
  'status',
  'startedAt',
  'completedAt',
  ...WORKFLOW_RUN_IO_PROPS,
];

const STEP_LISTED_PROPS: (keyof Step)[] = [
  'runId',
  'stepId',
  'stepName',
  'status',
  'startedAt',
  'completedAt',
  ...STEP_IO_PROPS,
];

const EVENT_IO_PROPS: (keyof Event | 'eventData')[] = ['eventData'];

const EVENT_LISTED_PROPS: (keyof Event | 'eventData')[] = [
  'eventId',
  'eventType',
  'correlationId',
  'createdAt',
  ...EVENT_IO_PROPS,
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

const getNonUniqueName = (dashSeparatedId: string) => {
  return dashSeparatedId.split('-').pop() ?? dashSeparatedId;
};

const formatTableValue = (
  prop: string,
  value: unknown,
  opts: InspectCLIOptions = {}
) => {
  if (value instanceof StreamID) {
    return value.toString();
  } else if (prop === 'streamId') {
    return chalk.green(value);
  } else if (prop === 'stepName') {
    const stepNameNonUnique = getNonUniqueName(String(value));
    return chalk.blue.blueBright(stepNameNonUnique);
  } else if (prop === 'workflowName') {
    const workflowNameNonUnique = getNonUniqueName(String(value));
    return chalk.blue.blueBright(workflowNameNonUnique);
  } else if (prop === 'output' || prop === 'input') {
    return inlineFormatIO(value);
  } else if (prop === 'status') {
    const status = value as WorkflowRun['status'] | Step['status'];
    const colorFunc = STATUS_COLORS[status];
    return colorFunc(status);
  } else if (prop === 'eventData') {
    return truncateString(JSON.stringify(value));
  } else if (value instanceof Date) {
    return formatTableTimestamp(value, opts);
  } else {
    return value;
  }
};

const showTable = (
  data: Record<string, unknown>[],
  props: string[],
  opts: InspectCLIOptions = {}
) => {
  // Add a blank line before any table
  const table = new Table();
  if (data && data.length === 0) {
    logger.warn('No data found for this query and resource.\n');
    for (const prop of props) {
      table.cell(prop, 'N/A');
    }
    table.newRow();
    return table.toString();
  } else if (!data) {
    logger.warn('Expecting an array of data, but got null.\n');
  }
  logger.log('');
  for (const item of data) {
    for (const prop of props) {
      const value = item[prop];
      table.cell(prop, formatTableValue(prop, value, opts));
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
    return `More results available. Append\n--cursor "${cursor}"\nto this command to fetch the next page.`;
  }
};

/**
 * In tables, we want to show a shorter timestamp, YYYY-MM-DD HH:MM:SS
 */
const formatTableTimestamp = (value: Date, opts: InspectCLIOptions = {}) => {
  const isoTime = value.toISOString();

  // If withData is disabled and we're not in JSON mode, we show relative time too,
  // since we have more space with the inputs/outputs hidden.
  if (!opts.withData && !opts.json) {
    const relative = formatDistance(value, new Date(), { addSuffix: true });
    return `${isoTime} (${relative})`;
  }

  return isoTime;
};

const truncateString = (
  str: string,
  maxLength: number = TABLE_TRUNCATE_IO_LENGTH
) => {
  return str && str.length > maxLength
    ? `${str.substring(0, maxLength)}...`
    : str;
};

/**
 * Takes hydrated step/workflow input/output and serializes it for inline display.
 */
const inlineFormatIO = <T>(io: T, topLevel: boolean = true): string => {
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
      const stringified = io
        .map((item) => inlineFormatIO(item, false))
        .join(',');
      if (stringified.length > TABLE_TRUNCATE_IO_LENGTH && topLevel) {
        value = chalk.yellow(`${io.length} args`);
      } else {
        value = stringified;
      }
    }
  } else if (type === 'object') {
    if (io instanceof StreamID) {
      value = io.toString();
    } else if (io instanceof Date) {
      value = io.toISOString();
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
  const resolveData = opts.withData ? 'all' : 'none';
  const runs = await world.runs.list({
    workflowName: opts.workflowName,
    pagination: {
      sortOrder: opts.sort || 'desc',
      cursor: opts.cursor,
      limit: opts.limit || DEFAULT_PAGE_SIZE,
    },
    resolveData,
  });
  const runsWithHydratedIO = runs.data.map(hydrateResourceIO);
  if (opts.stepId || opts.runId) {
    logger.warn(
      'Filtering by step-id or run-id is not supported in list calls, ignoring filter.'
    );
  }
  if (opts.json) {
    showJson({ ...runs, data: runsWithHydratedIO });
    return;
  }

  // Determine which props to show based on withData flag
  const props = opts.withData
    ? WORKFLOW_RUN_LISTED_PROPS
    : WORKFLOW_RUN_LISTED_PROPS.filter(
        (prop) => !WORKFLOW_RUN_IO_PROPS.includes(prop)
      );

  logger.showBox(
    'white',
    'INFO',
    'To view the input/output of a run, use `wf i run <run-id>`',
    'To view the content of any stream, use `wf i stream <stream-id>`'
  );
  const cursorHint = getCursorHint(runs);
  if (cursorHint) {
    logger.info(cursorHint);
  }
  logger.log(showTable(runsWithHydratedIO, props, opts));
};

export const getRecentRun = async (
  world: World,
  opts: InspectCLIOptions = {}
) => {
  logger.warn(`No runId provided, fetching data for latest run instead.`);
  const runs = await world.runs.list({
    pagination: { limit: 1, sortOrder: opts.sort || 'desc' },
    resolveData: 'none', // Don't need data for just getting the ID
  });
  runs.data = runs.data.map(hydrateResourceIO);
  return runs.data[0];
};

export const showRun = async (
  world: World,
  runId: string,
  opts: InspectCLIOptions = {}
) => {
  if (opts.withData) {
    logger.warn('`withData` flag is ignored when showing individual resources');
  }
  const run = await world.runs.get(runId, { resolveData: 'all' });
  const runWithHydratedIO = hydrateResourceIO(run);
  if (opts.json) {
    showJson(runWithHydratedIO);
    return;
  } else {
    logger.log(runWithHydratedIO);
  }
};

export const listSteps = async (
  world: World,
  opts: InspectCLIOptions = {
    runId: undefined,
  }
) => {
  if (opts.stepId) {
    logger.warn(
      'Filtering by step-id is not supported in list calls, ignoring filter.'
    );
  }
  if (opts.workflowName) {
    logger.warn(
      'Filtering by workflow-name is not supported for steps, ignoring filter.'
    );
  }

  const runId = opts.runId
    ? opts.runId
    : (await getRecentRun(world, opts))?.runId;
  if (!runId) {
    logger.error('No run found.');
    return;
  }

  logger.debug(`Fetching steps for run ${runId}`);
  const resolveData = opts.withData ? 'all' : 'none';
  const stepChunks = await world.steps.list({
    runId,
    pagination: {
      sortOrder: opts.sort || 'desc',
      cursor: opts.cursor,
      limit: opts.limit || DEFAULT_PAGE_SIZE,
    },
    resolveData,
  });
  const steps = stepChunks.data;
  const stepsWithHydratedIO = steps.map(hydrateResourceIO);

  if (opts.json) {
    showJson(steps);
    return;
  }
  // Determine which props to show based on withData flag
  const props = opts.withData
    ? STEP_LISTED_PROPS
    : STEP_LISTED_PROPS.filter((prop) => !STEP_IO_PROPS.includes(prop));

  logger.log(showTable(stepsWithHydratedIO, props, opts));
  logger.info(getCursorHint(stepChunks));
  logger.showBox(
    'white',
    'INFO',
    'To view the input/output of a step, use `wf i step <step-id>`',
    'To view the content of any stream, use `wf i stream <stream-id>`'
  );
};

export const showStep = async (
  world: World,
  stepId: string,
  opts: InspectCLIOptions = {}
) => {
  if (opts.withData) {
    logger.warn('`withData` flag is ignored when showing individual resources');
  }
  if (opts.stepId) {
    logger.warn(
      'Filtering by step-id is not supported in get calls, ignoring filter.'
    );
  }
  const step = await world.steps.get(opts.runId, stepId, {
    resolveData: 'all',
  });
  const stepWithHydratedIO = hydrateResourceIO(step);
  if (opts.json) {
    showJson(stepWithHydratedIO);
    return;
  } else {
    logger.log(stepWithHydratedIO);
  }
};

export const showStream = async (
  _: World,
  streamId: string,
  opts: InspectCLIOptions = {}
) => {
  if (opts.runId || opts.stepId) {
    logger.warn(
      'Filtering by run-id or step-id is not supported in get calls, ignoring filter.'
    );
  }
  const stream = getWorkflowReadableStream(streamId);
  logger.info('Streaming to stdout, press CTRL+C to abort.');
  logger.info(
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
  if (opts.withData) {
    logger.warn('`withData` flag is ignored when listing streams');
  }
  if (opts.workflowName) {
    logger.warn(
      'Filtering by workflow-name is not supported for streams, ignoring filter.'
    );
  }
  const steps: Step[] = [];
  const runs: WorkflowRun[] = [];
  if (opts.stepId) {
    const step = await world.steps.get(undefined, opts.stepId, {
      resolveData: 'all',
    });
    steps.push(step);
  } else if (opts.runId) {
    const run = await world.runs.get(opts.runId, { resolveData: 'all' });
    runs.push(run);
    const runsSteps = await world.steps.list({
      runId: opts.runId,
      pagination: {
        sortOrder: opts.sort || 'desc',
        cursor: opts.cursor,
        limit: opts.limit || DEFAULT_PAGE_SIZE,
      },
      resolveData: 'all', // Need data to find stream IDs
    });
    runsSteps.data.forEach((step: Step) => {
      steps.push(step);
    });
    logger.info(getCursorHint(runsSteps));
  } else {
    logger.warn(
      'No run-id or step-id provided. Listing streams for latest run instead.',
      'Use --run=<run-id> or --step=<step-id> to filter streams by run or step.'
    );
    const run = await getRecentRun(world, opts);
    if (!run) {
      logger.warn('No runs found.');
      return;
    }
    // Get full run data for stream listing
    const fullRun = await world.runs.get(run.runId, { resolveData: 'all' });
    runs.push(fullRun);
    const runsSteps = await world.steps.list({
      runId: runs[0].runId,
      pagination: {
        sortOrder: opts.sort || 'desc',
        cursor: opts.cursor,
        limit: opts.limit || DEFAULT_PAGE_SIZE,
      },
      resolveData: 'all', // Need data to find stream IDs
    });
    runsSteps.data.forEach((step: Step) => {
      steps.push(step);
    });
    logger.info(getCursorHint(runsSteps));
  }

  const runIds = runs.map((item) => item.runId);
  const stepIds = steps.map((item) => item.stepId);
  logger.debug(`Found IO for runs/steps: ${runIds.concat(stepIds).join(', ')}`);

  const runsWithHydratedIO = runs.map(hydrateResourceIO);
  const stepsWithHydratedIO = steps.map(hydrateResourceIO);

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
  logger.log(showTable(matchingStreams, ['runId', 'stepId', 'streamId']));
};

const findAllStreamIdsForObjectWithIO = (obj: {
  input: any;
  output: any;
  runId?: string;
  stepId?: string;
}) => {
  const matchingStreams: {
    runId?: string;
    stepId?: string;
    streamId: string;
  }[] = [];
  const inputStreams = getStreamIdsFromHydratedObject(obj.input);
  for (const streamId of inputStreams) {
    matchingStreams.push({
      runId: obj.runId,
      stepId: obj.stepId || '/',
      streamId,
    });
  }
  const outputStreams = getStreamIdsFromHydratedObject(obj.output);
  for (const streamId of outputStreams) {
    matchingStreams.push({
      runId: obj.runId,
      stepId: obj.stepId || '/',
      streamId,
    });
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
  if (opts.workflowName) {
    logger.warn(
      'Filtering by workflow-name is not supported for events, ignoring filter.'
    );
  }
  if (opts.stepId) {
    const step = await world.steps.get(undefined, opts.stepId, {
      resolveData: 'none',
    });
    const runId = step.runId;
    opts.runId = runId;
  }
  const runId = opts.runId
    ? opts.runId
    : (await getRecentRun(world, opts))?.runId;
  if (!runId) {
    logger.error('No run found.');
    return;
  }
  logger.debug(`Fetching events for run ${runId}`);
  const resolveData = opts.withData ? 'all' : 'none';
  const events = await world.events.list({
    runId,
    pagination: {
      sortOrder: opts.sort || 'desc',
      cursor: opts.cursor,
      limit: opts.limit || DEFAULT_PAGE_SIZE,
    },
    resolveData,
  });
  if (opts.stepId) {
    events.data = events.data.filter(
      (event) => event.correlationId === opts.stepId
    );
  }
  if (opts.json) {
    showJson(events.data);
    return;
  }

  // Determine which props to show based on withData flag
  const props = opts.withData
    ? EVENT_LISTED_PROPS
    : EVENT_LISTED_PROPS.filter((prop) => !EVENT_IO_PROPS.includes(prop));

  logger.log(showTable(events.data, props, opts));
  const hint = getCursorHint(events);
  if (hint) {
    logger.info(hint);
  }
};
