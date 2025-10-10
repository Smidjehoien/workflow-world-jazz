import path from 'node:path';
import {
  type Event,
  EventSchema,
  type Hook,
  HookSchema,
  type Step,
  StepSchema,
  type Storage,
  type WorkflowRun,
  WorkflowRunSchema,
} from '@vercel/workflow-world';
import { monotonicFactory } from 'ulid';
import {
  deleteJSON,
  listJSONFiles,
  paginatedFileSystemQuery,
  readJSON,
  ulidToDate,
  writeJSON,
} from './fs.js';

// Create a monotonic ULID factory that ensures ULIDs are always increasing
// even when generated within the same millisecond
const monotonicUlid = monotonicFactory(() => Math.random());

const getObjectCreatedAt =
  (idPrefix: string) =>
  (filename: string): Date | null => {
    const replaceRegex = new RegExp(`^${idPrefix}_`, 'g');
    const dashIndex = filename.indexOf('-');

    if (dashIndex === -1) {
      // No dash - extract ULID from the filename (e.g., wrun_ULID.json, evnt_ULID.json)
      const ulid = filename.replace(/\.json$/, '').replace(replaceRegex, '');
      return ulidToDate(ulid);
    }

    // For composite keys like {runId}-{stepId}, extract from the appropriate part
    if (idPrefix === 'step') {
      // For steps: wrun_ULID-step_123.json - extract from the runId part
      const runId = filename.substring(0, dashIndex);
      const ulid = runId.replace(/^wrun_/, '');
      return ulidToDate(ulid);
    }

    // For events: wrun_ULID-evnt_ULID.json - extract from the eventId part
    const id = filename.substring(dashIndex + 1).replace(/\.json$/, '');
    const ulid = id.replace(replaceRegex, '');
    return ulidToDate(ulid);
  };

export function createStorage(basedir: string): Storage {
  return {
    runs: {
      async create(data) {
        const runId = `wrun_${monotonicUlid()}`;
        const now = new Date();

        const result: WorkflowRun = {
          runId,
          deploymentId: data.deploymentId,
          status: 'pending',
          workflowName: data.workflowName,
          executionContext: data.executionContext as
            | Record<string, any>
            | undefined,
          input: (data.input as any[]) || [],
          output: undefined,
          error: undefined,
          errorCode: undefined,
          startedAt: undefined,
          completedAt: undefined,
          createdAt: now,
          updatedAt: now,
        };

        const runPath = path.join(basedir, 'runs', `${runId}.json`);
        await writeJSON(runPath, result);
        return result;
      },

      async get(id) {
        const runPath = path.join(basedir, 'runs', `${id}.json`);
        const run = await readJSON(runPath, WorkflowRunSchema);
        if (!run) {
          throw new Error(`Workflow run ${id} not found`);
        }
        return run;
      },

      async update(id, data) {
        const runPath = path.join(basedir, 'runs', `${id}.json`);
        const run = await readJSON(runPath, WorkflowRunSchema);
        if (!run) {
          throw new Error(`Workflow run ${id} not found`);
        }

        const now = new Date();
        const updatedRun: WorkflowRun = {
          ...run,
          ...data,
          updatedAt: now,
        };

        if (data.status === 'running') {
          updatedRun.startedAt = now;
        }
        if (
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'cancelled'
        ) {
          updatedRun.completedAt = now;
        }

        await writeJSON(runPath, updatedRun, { overwrite: true });
        return updatedRun;
      },

      async list(params) {
        return paginatedFileSystemQuery({
          directory: path.join(basedir, 'runs'),
          schema: WorkflowRunSchema,
          filter: params?.workflowName
            ? (run) => run.workflowName === params.workflowName
            : undefined,
          sortOrder: params?.pagination?.sortOrder ?? 'desc',
          limit: params?.pagination?.limit,
          cursor: params?.pagination?.cursor,
          getCreatedAt: getObjectCreatedAt('wrun'),
          getId: (run) => run.runId,
        });
      },

      async cancel(id) {
        return this.update(id, { status: 'cancelled' });
      },

      async pause(id) {
        return this.update(id, { status: 'paused' });
      },

      async resume(id) {
        return this.update(id, { status: 'running' });
      },
    },

    steps: {
      async create(runId, data) {
        const now = new Date();

        const result: Step = {
          runId,
          stepId: data.stepId,
          stepName: data.stepName,
          status: 'pending',
          input: data.input as any[],
          output: undefined,
          error: undefined,
          errorCode: undefined,
          attempt: 1,
          startedAt: undefined,
          completedAt: undefined,
          createdAt: now,
          updatedAt: now,
        };

        const compositeKey = `${runId}-${data.stepId}`;
        const stepPath = path.join(basedir, 'steps', `${compositeKey}.json`);
        await writeJSON(stepPath, result);

        return result;
      },

      async get(runId: string | undefined, stepId: string): Promise<Step> {
        if (!runId) {
          const fileIds = await listJSONFiles(path.join(basedir, 'steps'));
          const fileId = fileIds.find((fileId) =>
            fileId.endsWith(`-${stepId}`)
          );
          if (!fileId) {
            throw new Error(`Step ${stepId} not found`);
          }
          runId = fileId.split('-')[0];
        }
        const compositeKey = `${runId}-${stepId}`;
        const stepPath = path.join(basedir, 'steps', `${compositeKey}.json`);
        const step = await readJSON(stepPath, StepSchema);
        if (!step) {
          throw new Error(`Step ${stepId} in run ${runId} not found`);
        }
        return step;
      },

      async update(runId, stepId, data) {
        const compositeKey = `${runId}-${stepId}`;
        const stepPath = path.join(basedir, 'steps', `${compositeKey}.json`);
        const step = await readJSON(stepPath, StepSchema);
        if (!step) {
          throw new Error(`Step ${stepId} in run ${runId} not found`);
        }

        const now = new Date();
        const updatedStep: Step = {
          ...step,
          ...data,
          updatedAt: now,
        };

        if (data.status === 'running') {
          updatedStep.startedAt = now;
        }
        if (data.status === 'completed' || data.status === 'failed') {
          updatedStep.completedAt = now;
        }

        await writeJSON(stepPath, updatedStep, { overwrite: true });
        return updatedStep;
      },

      async list(params) {
        return paginatedFileSystemQuery({
          directory: path.join(basedir, 'steps'),
          schema: StepSchema,
          filePrefix: `${params.runId}-`,
          sortOrder: params.pagination?.sortOrder ?? 'desc',
          limit: params.pagination?.limit,
          cursor: params.pagination?.cursor,
          getCreatedAt: getObjectCreatedAt('step'),
          getId: (step) => step.stepId,
        });
      },
    },

    // Events - filesystem-backed storage
    events: {
      async create(runId, data) {
        const eventId = `evnt_${monotonicUlid()}`;
        const now = new Date();

        const result: Event = {
          ...data,
          runId,
          eventId,
          createdAt: now,
        };

        // Store event using composite key {runId}-{eventId}
        const compositeKey = `${runId}-${eventId}`;
        const eventPath = path.join(basedir, 'events', `${compositeKey}.json`);
        await writeJSON(eventPath, result);

        return result;
      },

      async list(params) {
        return paginatedFileSystemQuery({
          directory: path.join(basedir, 'events'),
          schema: EventSchema,
          filePrefix: `${params.runId}-`,
          // Events in chronological order (oldest first) by default,
          // different from the default for other list calls.
          sortOrder: params.pagination?.sortOrder ?? 'asc',
          limit: params.pagination?.limit,
          cursor: params.pagination?.cursor,
          getCreatedAt: getObjectCreatedAt('evnt'),
          getId: (event) => event.eventId,
        });
      },
    },

    // Hooks
    hooks: {
      async create(runId, data) {
        const now = new Date();

        const result: Hook = {
          runId,
          hookId: data.hookId,
          token: data.token,
          ownerId: 'embedded-owner',
          projectId: 'embedded-project',
          environment: 'embedded',
          createdAt: now,
        };

        const hookPath = path.join(basedir, 'hooks', `${data.hookId}.json`);
        await writeJSON(hookPath, result);
        return result;
      },

      async getByToken(token) {
        // Need to search through all hooks to find one with matching token
        const hooksDir = path.join(basedir, 'hooks');
        const files = await listJSONFiles(hooksDir);

        for (const file of files) {
          const hookPath = path.join(hooksDir, `${file}.json`);
          const hook = await readJSON(hookPath, HookSchema);
          if (hook && hook.token === token) {
            return hook;
          }
        }

        throw new Error(`Hook with token ${token} not found`);
      },

      async dispose(hookId) {
        const hookPath = path.join(basedir, 'hooks', `${hookId}.json`);
        const hook = await readJSON(hookPath, HookSchema);
        if (!hook) {
          throw new Error(`Hook ${hookId} not found`);
        }
        await deleteJSON(hookPath);
        return hook;
      },
    },
  };
}
