import path from 'node:path';
import {
  type Event,
  EventSchema,
  type Step,
  StepSchema,
  type Storage,
  type Webhook,
  WebhookSchema,
  type WorkflowRun,
  WorkflowRunSchema,
} from '@vercel/workflow-world';
import {
  deleteJSON,
  paginatedFileSystemQuery,
  readJSON,
  ulidToDate,
  writeJSON,
} from './fs.js';
import { generateLexiProcessTime } from './lexi-process-time.js';

export function createStorage(basedir: string): Storage {
  return {
    runs: {
      async create(data) {
        const runId = `wrun_${generateLexiProcessTime()}`;
        const now = new Date();

        const result: WorkflowRun = {
          runId,
          deploymentId: data.deploymentId,
          status: 'pending',
          workflowName: data.workflowName,
          executionContext: data.executionContext as
            | Record<string, any>
            | undefined,
          input: data.input as any[],
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

        await writeJSON(runPath, updatedRun);
        return updatedRun;
      },

      async list(params) {
        return paginatedFileSystemQuery({
          directory: path.join(basedir, 'runs'),
          schema: WorkflowRunSchema,
          filter: params?.workflowName
            ? (run) => run.workflowName === params.workflowName
            : undefined,
          sortOrder: 'desc',
          limit: params?.pagination?.limit,
          cursor: params?.pagination?.cursor,
          getCreatedAt: (file) => {
            const runId = file.split('.')[0];
            const ulid = runId?.replace(/^wrun_/, '');
            return ulidToDate(ulid);
          },
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

      async get(runId, stepId) {
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

        await writeJSON(stepPath, updatedStep);
        return updatedStep;
      },

      async list(params) {
        return paginatedFileSystemQuery({
          directory: path.join(basedir, 'steps'),
          schema: StepSchema,
          filePrefix: `${params.runId}-`,
          sortOrder: 'desc',
          limit: params.pagination?.limit,
          cursor: params.pagination?.cursor,
          getCreatedAt: (filename) => {
            // Extract stepId from filename format: ${runId}-${stepId}.json
            // Since runId is a ULID and doesn't contain dashes, we can split and take everything after first dash
            const dashIndex = filename.indexOf('-');
            if (dashIndex === -1) return null;

            const stepId = filename
              .substring(dashIndex + 1)
              .replace(/\.json$/, '');
            // Remove step_ prefix to get the ULID portion
            const ulid = stepId.replace(/^step_/, '');
            return ulidToDate(ulid);
          },
        });
      },
    },

    // Events - filesystem-backed storage
    events: {
      async create(runId, data) {
        const eventId = `evnt_${generateLexiProcessTime()}`;
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
          sortOrder: 'asc', // Events in chronological order (oldest first)
          limit: params.pagination?.limit,
          cursor: params.pagination?.cursor,
          getCreatedAt: (filename) => {
            const eventId = filename.split('-')[1]?.split('.')[0];
            const ulid = eventId?.replace(/^evnt_/, '');
            return ulidToDate(ulid);
          },
        });
      },
    },

    // Webhooks
    webhooks: {
      async create(runId, data) {
        const now = new Date();

        const result: Webhook = {
          runId,
          webhookId: data.webhookId,
          ownerId: 'embedded-owner',
          projectId: 'embedded-project',
          environment: 'embedded',
          allowedMethods: data.allowedMethods || [],
          createdAt: now,
          updatedAt: now,
          url: data.url,
          searchParamsSchema: data.searchParamsSchema,
          headersSchema: data.headersSchema,
          bodySchema: data.bodySchema,
        };

        const webhookPath = path.join(
          basedir,
          'webhooks',
          `${data.webhookId}.json`
        );
        await writeJSON(webhookPath, result);
        return result;
      },

      async get(webhookId, _deploymentId) {
        const webhookPath = path.join(basedir, 'webhooks', `${webhookId}.json`);
        const webhook = await readJSON(webhookPath, WebhookSchema);
        if (!webhook) {
          throw new Error(`Webhook ${webhookId} not found`);
        }
        return webhook;
      },

      async dispose(webhookId, deploymentId) {
        const webhook = await this.get(webhookId, deploymentId);
        const webhookPath = path.join(basedir, 'webhooks', `${webhookId}.json`);
        await deleteJSON(webhookPath);
        return webhook;
      },

      async getByUrl(url, _deploymentId, params) {
        return paginatedFileSystemQuery({
          directory: path.join(basedir, 'webhooks'),
          schema: WebhookSchema,
          filter: (webhook) => webhook.url === url,
          sortOrder: 'desc',
          limit: params?.limit,
          cursor: undefined, // Remove buggy page-to-date conversion, use standard cursor pagination
          getCreatedAt: (filename) =>
            ulidToDate(filename.replace(/\.json$/, '')),
        });
      },
    },
  };
}
