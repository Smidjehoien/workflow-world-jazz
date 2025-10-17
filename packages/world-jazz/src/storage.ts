import type {
  CreateEventRequest,
  CreateHookRequest,
  CreateStepRequest,
  CreateWorkflowRunRequest,
  Event,
  GetHookParams,
  Hook,
  ListEventsParams,
  ListHooksParams,
  ListWorkflowRunStepsParams,
  ListWorkflowRunsParams,
  PaginatedResponse,
  Step,
  Storage,
  UpdateStepRequest,
  UpdateWorkflowRunRequest,
  WorkflowRun,
} from '@vercel/workflow-world';
import { co } from 'jazz-tools';
import { z } from 'zod';
import {
  JazzEvent,
  JazzHook,
  JazzStep,
  type JazzStorageAccountResolver,
  JazzWorkflowRun,
} from './types.js';

export const createStorage = (
  ensureLoaded: JazzStorageAccountResolver
): Storage => ({
  steps: createStepStorage(ensureLoaded),
  events: createEventStorage(ensureLoaded),
  hooks: createHookStorage(ensureLoaded),
  runs: createRunStorage(ensureLoaded),
});

export const createRunStorage = (
  ensureLoaded: JazzStorageAccountResolver
): Storage['runs'] => {
  const loadRuns = async () => {
    return (
      await ensureLoaded({
        root: {
          runs: true,
        },
      })
    ).root.runs;
  };

  return {
    async create(data: CreateWorkflowRunRequest): Promise<WorkflowRun> {
      const runs = await loadRuns();

      const now = new Date();
      const jwr = JazzWorkflowRun.create({
        ...data,
        input: data.input as z.core.util.JSONType[], // everything should be JSON serializable
        executionContext: data.executionContext as Record<
          string,
          z.core.util.JSONType
        >,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      runs.$jazz.push(jwr);

      return toWorkflowRun(jwr);
    },

    async get(id: string): Promise<WorkflowRun> {
      // Needed because World creation is synchronous
      await ensureLoaded({});

      const jwr = await JazzWorkflowRun.load(id, {
        resolve: {
          executionContext: true,
        },
      });
      if (!jwr) {
        throw new Error(`Workflow run ${id} not found`);
      }

      return toWorkflowRun(jwr);
    },

    async update(
      id: string,
      data: UpdateWorkflowRunRequest
    ): Promise<WorkflowRun> {
      // Needed because World creation is synchronous
      await ensureLoaded({});

      const jwr = await JazzWorkflowRun.load(id, {
        resolve: {
          executionContext: true,
        },
      });
      if (!jwr) {
        throw new Error(`Workflow run ${id} not found`);
      }

      const now = new Date();
      jwr.$jazz.set('updatedAt', now);

      if (data.status !== undefined) {
        jwr.$jazz.set('status', data.status);
      }
      if (data.output !== undefined) {
        jwr.$jazz.set('output', data.output as z.core.util.JSONType);
      }
      if (data.error !== undefined) {
        jwr.$jazz.set('error', data.error);
      }
      if (data.errorCode !== undefined) {
        jwr.$jazz.set('errorCode', data.errorCode);
      }
      if (data.executionContext !== undefined) {
        jwr.$jazz.set(
          'executionContext',
          data.executionContext as Record<string, z.core.util.JSONType>
        );
      }

      if (data.status === 'running') {
        jwr.$jazz.set('startedAt', now);
      }
      if (
        data.status === 'completed' ||
        data.status === 'failed' ||
        data.status === 'cancelled'
      ) {
        jwr.$jazz.set('completedAt', now);
      }

      return toWorkflowRun(jwr);
    },

    async list(
      params?: ListWorkflowRunsParams
    ): Promise<PaginatedResponse<WorkflowRun>> {
      const shallowRuns = await loadRuns();
      const runs = await shallowRuns.$jazz.ensureLoaded({
        resolve: {
          $each: {
            executionContext: true,
          },
        },
      });

      const eligibleRuns = runs.filter((jwr) => jwr !== null);
      return paginateItems({
        items: eligibleRuns,
        cursor: params?.pagination?.cursor,
        limit: params?.pagination?.limit,
        findCursorIndex: (items, cursor) =>
          items.findIndex((jwr) => jwr.$jazz.id === cursor),
        getItemId: (jwr) => jwr.$jazz.id,
        transform: toWorkflowRun,
        filter: (jwr) => {
          // Filter by workflow name
          if (
            params?.workflowName &&
            jwr.workflowName !== params.workflowName
          ) {
            return false;
          }
          // Filter by status
          if (params?.status && jwr.status !== params.status) {
            return false;
          }
          return true;
        },
      });
    },

    async cancel(id: string): Promise<WorkflowRun> {
      return this.update(id, { status: 'cancelled' });
    },

    async pause(id: string): Promise<WorkflowRun> {
      return this.update(id, { status: 'paused' });
    },

    async resume(id: string): Promise<WorkflowRun> {
      return this.update(id, { status: 'running' });
    },
  };
};

export const createStepStorage = (
  ensureLoaded: JazzStorageAccountResolver
): Storage['steps'] => {
  const loadOrCreateSteps = async (runId: string) => {
    const stepsByRunId = (
      await ensureLoaded({
        root: {
          steps: true,
        },
      })
    ).root.steps;

    const stepsRef = stepsByRunId.$jazz.refs[runId];

    if (stepsRef) {
      const steps = await stepsRef.load();
      if (!steps) {
        throw new Error(`Steps for run ${runId} not found`);
      }
      return steps;
    } else {
      const runSteps = co.record(z.string(), JazzStep).create({});
      stepsByRunId.$jazz.set(runId, runSteps);
      return runSteps;
    }
  };

  const getRunStep = async (runId: string, stepId: string) => {
    const steps = await loadOrCreateSteps(runId);
    if (steps[stepId] === undefined) {
      throw new Error(`Step ${stepId} in run ${runId} not found`);
    }
    return (
      steps[stepId] ??
      steps[stepId] ??
      // biome-ignore lint/style/noNonNullAssertion: it's null (vs. undefined) because it exists
      (
        await steps.$jazz.ensureLoaded({
          resolve: {
            [stepId]: true,
          },
        })
      )[stepId]!
    );
  };

  return {
    async create(runId: string, data: CreateStepRequest): Promise<Step> {
      const now = new Date();
      const js = JazzStep.create({
        ...data,
        runId,
        status: 'pending',
        input: data.input as z.core.util.JSONType[],
        attempt: 1,
        createdAt: now,
        updatedAt: now,
      });

      const steps = await loadOrCreateSteps(runId);
      steps.$jazz.set(data.stepId, js);

      return toStep(js);
    },

    async get(runId: string, stepId: string): Promise<Step> {
      const js = await getRunStep(runId, stepId);
      return toStep(js);
    },

    async update(
      runId: string,
      stepId: string,
      data: UpdateStepRequest
    ): Promise<Step> {
      const js = await getRunStep(runId, stepId);

      const now = new Date();
      js.$jazz.set('updatedAt', now);

      if (data.status !== undefined) {
        js.$jazz.set('status', data.status);
      }
      if (data.output !== undefined) {
        js.$jazz.set('output', data.output as z.core.util.JSONType);
      }
      if (data.error !== undefined) {
        js.$jazz.set('error', data.error);
      }
      if (data.errorCode !== undefined) {
        js.$jazz.set('errorCode', data.errorCode);
      }

      if (data.status === 'running') {
        js.$jazz.set('startedAt', now);
      }
      if (data.status === 'completed' || data.status === 'failed') {
        js.$jazz.set('completedAt', now);
      }

      return toStep(js);
    },

    async list(
      params: ListWorkflowRunStepsParams
    ): Promise<PaginatedResponse<Step>> {
      const steps = await loadOrCreateSteps(params.runId);
      await steps.$jazz.ensureLoaded({
        resolve: {
          $each: true,
        },
      });
      const eligibleSteps = Object.values(steps).filter((js) => js !== null);
      return paginateItems({
        items: eligibleSteps,
        cursor: params?.pagination?.cursor,
        limit: params?.pagination?.limit,
        findCursorIndex: (items, cursor) =>
          items.findIndex((js) => js.stepId === cursor),
        getItemId: (js) => js.stepId,
        transform: toStep,
      });
    },
  };
};

export const createHookStorage = (
  ensureLoaded: JazzStorageAccountResolver
): Storage['hooks'] => {
  const loadHooks = async () => {
    return (
      await ensureLoaded({
        root: {
          hooks: true,
        },
      })
    ).root.hooks;
  };

  return {
    async create(runId: string, data: CreateHookRequest): Promise<Hook> {
      const now = new Date();
      const jh = JazzHook.create({
        runId,
        hookId: data.hookId,
        token: data.token,
        ownerId: 'jazz-owner',
        projectId: 'jazz-project',
        environment: 'jazz',
        metadata: data.metadata as z.core.util.JSONType,
        createdAt: now,
      });

      const hooks = await loadHooks();
      hooks.$jazz.set(data.token, jh);

      return toHook(jh);
    },

    async get(hookId: string, _params?: GetHookParams): Promise<Hook> {
      // Find the hook by hookId (iterate through all hooks)
      const hooks = await loadHooks();

      for (const [_token, ref] of Object.entries(hooks.$jazz.refs)) {
        const jh = await ref.load();
        if (jh && jh.hookId === hookId) {
          return toHook(jh);
        }
      }

      throw new Error(`Hook ${hookId} not found`);
    },

    async getByToken(token: string): Promise<Hook> {
      const hooks = await loadHooks();

      if (hooks[token] === undefined) {
        throw new Error(`Hook with token ${token} not found`);
      }

      const jh =
        hooks[token] ??
        // biome-ignore lint/style/noNonNullAssertion: it's null (vs. undefined) because it exists
        (
          await hooks.$jazz.ensureLoaded({
            resolve: {
              [token]: true,
            },
          })
        )[token]!;

      return toHook(jh);
    },

    async list(params: ListHooksParams): Promise<PaginatedResponse<Hook>> {
      const hooks = await loadHooks();
      const allHooks: JazzHook[] = [];

      // Load all hooks
      for (const [_token, ref] of Object.entries(hooks.$jazz.refs)) {
        const jh = await ref.load();
        if (jh) {
          allHooks.push(jh);
        }
      }

      // Filter by runId if provided
      const filteredHooks = params.runId
        ? allHooks.filter((jh) => jh.runId === params.runId)
        : allHooks;

      // Sort by createdAt descending by default
      const sortOrder = params.pagination?.sortOrder || 'desc';
      const sortedHooks = filteredHooks.sort((a, b) => {
        const aTime = a.createdAt.getTime();
        const bTime = b.createdAt.getTime();
        return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
      });

      return paginateItems({
        items: sortedHooks,
        cursor: params.pagination?.cursor,
        limit: params.pagination?.limit,
        findCursorIndex: (items, cursor) =>
          items.findIndex((jh) => jh.$jazz.id === cursor),
        getItemId: (jh) => jh.$jazz.id,
        transform: toHook,
      });
    },

    async dispose(hookId: string): Promise<Hook> {
      // Find the hook by hookId (iterate through all hooks)
      const hooks = await loadHooks();

      for (const [token, ref] of Object.entries(hooks.$jazz.refs)) {
        const jh = await ref.load();
        if (jh && jh.hookId === hookId) {
          const hook = toHook(jh);
          hooks.$jazz.delete(token);
          return hook;
        }
      }

      throw new Error(`Hook ${hookId} not found`);
    },
  };
};

export const createEventStorage = (
  ensureLoaded: JazzStorageAccountResolver
): Storage['events'] => {
  const loadOrCreateEvents = async (runId: string) => {
    const eventsByRunId = (
      await ensureLoaded({
        root: {
          events: true,
        },
      })
    ).root.events;

    const eventsRef = eventsByRunId.$jazz.refs[runId];

    if (eventsRef) {
      const events = await eventsRef.load();
      if (!events) {
        throw new Error(`Events for run ${runId} not found`);
      }
      return events;
    } else {
      const runEvents = co.list(JazzEvent).create([]);
      eventsByRunId.$jazz.set(runId, runEvents);
      return runEvents;
    }
  };

  return {
    async create(runId: string, data: CreateEventRequest): Promise<Event> {
      const now = new Date();
      const je: JazzEvent = JazzEvent.create({
        runId,
        createdAt: now,
        // biome-ignore lint/suspicious/noExplicitAny: discriminatedUnion difficulties
        ...(data as any),
      });

      const events = await loadOrCreateEvents(runId);
      events.$jazz.push(je);

      return toEvent(je);
    },

    async list(params: ListEventsParams): Promise<PaginatedResponse<Event>> {
      const events = await loadOrCreateEvents(params.runId);
      const loadedEvents = await events.$jazz.ensureLoaded({
        resolve: {
          $each: true,
        },
      });
      const eligibleEvents = loadedEvents.filter((je) => je !== null);
      return paginateItems({
        items: eligibleEvents,
        cursor: params?.pagination?.cursor,
        limit: params?.pagination?.limit,
        findCursorIndex: (items, cursor) =>
          items.findIndex((je) => je.$jazz.id === cursor),
        getItemId: (je) => je.$jazz.id,
        transform: toEvent,
      });
    },
  };
};

function paginateItems<T, TItem>({
  items,
  cursor,
  limit,
  findCursorIndex,
  getItemId,
  transform,
  filter,
}: {
  items: TItem[];
  cursor?: string;
  limit?: number;
  findCursorIndex?: (items: TItem[], cursor: string) => number;
  getItemId: (item: TItem) => string;
  transform: (item: TItem) => T;
  filter?: (item: TItem) => boolean;
}): PaginatedResponse<T> {
  const eligibleItems: TItem[] = [];

  let startIndex = 0;
  if (cursor && findCursorIndex) {
    startIndex = findCursorIndex(items, cursor) + 1;
  }

  for (let i = startIndex; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      console.warn(`Item ${i} is undefined`);
      continue;
    }

    // Apply filter if provided
    if (filter && !filter(item)) {
      continue;
    }

    eligibleItems.push(item);
  }

  const limitedItems = limit ? eligibleItems.slice(0, limit) : eligibleItems;
  const hasMore = limit ? eligibleItems.length > limit : false;
  const nextCursor = hasMore
    ? getItemId(limitedItems[limitedItems.length - 1])
    : null;

  return {
    data: limitedItems.map(transform),
    cursor: nextCursor,
    hasMore,
  };
}

function toWorkflowRun(jwr: JazzWorkflowRun): WorkflowRun {
  return {
    runId: jwr.$jazz.id,
    deploymentId: jwr.deploymentId,
    status: jwr.status,
    workflowName: jwr.workflowName,
    executionContext: jwr.executionContext as
      | Record<string, z.core.util.JSONType>
      | undefined,
    input: jwr.input as z.core.util.JSONType[],
    output: jwr.output,
    error: jwr.error,
    errorCode: jwr.errorCode,
    startedAt: jwr.startedAt,
    completedAt: jwr.completedAt,
    createdAt: jwr.createdAt,
    updatedAt: jwr.updatedAt,
  };
}

function toStep(js: JazzStep): Step {
  return {
    runId: js.runId,
    stepId: js.stepId,
    stepName: js.stepName,
    status: js.status,
    input: js.input,
    output: js.output,
    error: js.error,
    errorCode: js.errorCode,
    attempt: js.attempt,
    startedAt: js.startedAt,
    completedAt: js.completedAt,
    createdAt: js.createdAt,
    updatedAt: js.updatedAt,
  };
}

function toEvent(je: JazzEvent): Event {
  return {
    runId: je.runId,
    eventId: je.$jazz.id,
    eventType: je.eventType,
    eventData: je.eventData,
    correlationId: je.correlationId,
    createdAt: je.createdAt,
  } as Event;
}

function toHook(jh: JazzHook): Hook {
  return {
    runId: jh.runId,
    hookId: jh.hookId,
    token: jh.token,
    ownerId: jh.ownerId,
    projectId: jh.projectId,
    environment: jh.environment,
    metadata: jh.metadata as z.core.util.JSONType,
    createdAt: jh.createdAt,
  };
}
