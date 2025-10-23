import type { Step, Storage, WorkflowRun } from '@workflow/world';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStorage } from './storage.js';
import { createJazzTestAccountResolver } from './testUtils.js';

describe('Jazz Storage', () => {
  let storage: Storage;

  async function newStorage(): Promise<Storage> {
    const ensureLoaded = createJazzTestAccountResolver();
    return createStorage(ensureLoaded);
  }

  beforeEach(async () => {
    storage = await newStorage();
  });

  describe('runs', () => {
    describe('ID conversion behavior', () => {
      it('should create run with wrun_ prefix in returned runId', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const result = await storage.runs.create(createRequest);

        expect(result.runId).toMatch(/^wrun_/);
      });

      it('should retrieve run using wrun_ prefix and return wrun_ prefix', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const created = await storage.runs.create(createRequest);
        const retrieved = await storage.runs.get(created.runId);

        expect(retrieved.runId).toMatch(/^wrun_/);
        expect(retrieved.runId).toBe(created.runId);
      });

      it('should update run using wrun_ prefix and return wrun_ prefix', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const created = await storage.runs.create(createRequest);
        const updated = await storage.runs.update(created.runId, {
          status: 'running',
        });

        expect(updated.runId).toMatch(/^wrun_/);
        expect(updated.runId).toBe(created.runId);
      });

      it('should list runs with wrun_ prefix in returned runIds', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        await storage.runs.create(createRequest);
        const listResult = await storage.runs.list();

        expect(listResult.data).toHaveLength(1);
        expect(listResult.data[0].runId).toMatch(/^wrun_/);
      });
    });

    describe('create', () => {
      it('should create a new workflow run with all required fields', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['arg1', 'arg2', { nested: 'object' }],
          executionContext: { userId: 'user123', environment: 'test' },
        };

        const result = await storage.runs.create(createRequest);

        expect(result).toMatchObject({
          status: 'pending',
          ...createRequest,
        });
        expect(result.runId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
        expect(result.startedAt).toBeUndefined();
        expect(result.completedAt).toBeUndefined();
        expect(result.output).toBeUndefined();
        expect(result.error).toBeUndefined();
        expect(result.errorCode).toBeUndefined();
      });

      it('should create a workflow run without execution context', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['simple', 'args'],
        };

        const result = await storage.runs.create(createRequest);

        expect(result).toMatchObject({
          status: 'pending',
          executionContext: undefined,
          ...createRequest,
        });
      });

      it('should create a workflow run with empty input array', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: [],
        };

        const result = await storage.runs.create(createRequest);

        expect(result.input).toEqual([]);
      });

      it('should handle complex JSON serializable input', async () => {
        const complexInput = [
          { nested: { deeply: { value: 42 } } },
          [1, 2, { mixed: 'array' }],
          null,
          true,
          3.14,
        ];

        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: complexInput,
        };

        const result = await storage.runs.create(createRequest);

        expect(result.input).toEqual(complexInput);
      });

      it('should handle large input values (>1048576 bytes)', async () => {
        // Generate a large string that exceeds 1MB (1048576 bytes)
        const largeString = 'x'.repeat(1048577); // 1MB + 1 byte
        const largeInput = [
          {
            largeData: largeString,
            metadata: {
              size: largeString.length,
              description: 'Large run input test data',
              timestamp: new Date().toISOString(),
              inputDetails: {
                source: 'external-api',
                recordCount: 1000000,
                summary: 'Large dataset input for workflow processing',
              },
            },
          },
          'additional-param',
          { config: { processingMode: 'batch' } },
        ];

        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: largeInput,
        };

        const result = await storage.runs.create(createRequest);

        expect(result).toMatchObject({
          status: 'pending',
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
        });
        expect(result.runId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);

        // Verify the large input data is preserved correctly
        expect(result.input).toEqual(largeInput);
        const inputData = result.input[0] as { largeData: string; metadata: any };
        expect(inputData.largeData).toBe(largeString);
        expect(inputData.largeData.length).toBe(1048577);
        expect(inputData.metadata.size).toBe(1048577);
        expect(inputData.metadata.inputDetails.recordCount).toBe(1000000);

        // Verify we can retrieve the run with large input data
        const retrieved = await storage.runs.get(result.runId);
        expect(retrieved.input).toEqual(largeInput);
        const retrievedInputData = retrieved.input[0] as { largeData: string; metadata: any };
        expect(retrievedInputData.largeData).toBe(largeString);
        expect(retrievedInputData.largeData.length).toBe(1048577);
        expect(retrievedInputData.metadata.size).toBe(1048577);
      });
    });

    describe('get', () => {
      it('should retrieve an existing workflow run', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const created = await storage.runs.create(createRequest);
        const retrieved = await storage.runs.get(created.runId);

        expect(retrieved).toEqual(created);
      });

      it('should throw error when run does not exist', async () => {
        await expect(storage.runs.get('co_z123')).rejects.toThrow();
      });

      it('should retrieve run with all fields populated', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test'],
          executionContext: { key: 'value' },
        };

        const created = await storage.runs.create(createRequest);

        // Update the run to have all fields - first set to running to get startedAt
        await storage.runs.update(created.runId, {
          status: 'running',
        });

        const updated = await storage.runs.update(created.runId, {
          status: 'completed',
          output: { result: 'success' },
        });

        const retrieved = await storage.runs.get(created.runId);

        expect(retrieved).toEqual(updated);
        expect(retrieved.status).toBe('completed');
        expect(retrieved.output).toEqual({ result: 'success' });
        expect(retrieved.startedAt).toBeDefined();
        expect(retrieved.completedAt).toBeDefined();
      });
    });

    describe('update', () => {
      let createdRun: WorkflowRun;

      beforeEach(async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['initial', 'data'],
        };
        createdRun = await storage.runs.create(createRequest);
      });

      it('should update status to running and set startedAt', async () => {
        const updated = await storage.runs.update(createdRun.runId, {
          status: 'running',
        });

        expect(updated.status).toBe('running');
        expect(updated.startedAt).toBeInstanceOf(Date);
        expect(updated.updatedAt.getTime()).toBeGreaterThan(
          createdRun.updatedAt.getTime()
        );
        expect(updated.completedAt).toBeUndefined();
      });

      it('should update status to completed and set completedAt', async () => {
        const updated = await storage.runs.update(createdRun.runId, {
          status: 'completed',
          output: { result: 'success' },
        });

        expect(updated.status).toBe('completed');
        expect(updated.output).toEqual({ result: 'success' });
        expect(updated.completedAt).toBeInstanceOf(Date);
        expect(updated.updatedAt.getTime()).toBeGreaterThan(
          createdRun.updatedAt.getTime()
        );
      });

      it('should update status to failed and set completedAt', async () => {
        const updated = await storage.runs.update(createdRun.runId, {
          status: 'failed',
          error: 'Something went wrong',
          errorCode: 'RUNTIME_ERROR',
        });

        expect(updated.status).toBe('failed');
        expect(updated.error).toBe('Something went wrong');
        expect(updated.errorCode).toBe('RUNTIME_ERROR');
        expect(updated.completedAt).toBeInstanceOf(Date);
      });

      it('should update status to cancelled and set completedAt', async () => {
        const updated = await storage.runs.update(createdRun.runId, {
          status: 'cancelled',
        });

        expect(updated.status).toBe('cancelled');
        expect(updated.completedAt).toBeInstanceOf(Date);
      });

      it('should update execution context', async () => {
        const newContext = { userId: 'user456', sessionId: 'session789' };
        const updated = await storage.runs.update(createdRun.runId, {
          executionContext: newContext,
        });

        expect(updated.executionContext).toEqual(newContext);
      });

      it('should update multiple fields at once', async () => {
        const updated = await storage.runs.update(createdRun.runId, {
          status: 'running',
          executionContext: { step: 'processing' },
        });

        expect(updated.status).toBe('running');
        expect(updated.executionContext).toEqual({ step: 'processing' });
        expect(updated.startedAt).toBeInstanceOf(Date);
      });

      it('should throw error when run does not exist', async () => {
        await expect(
          storage.runs.update('co_z123', { status: 'running' })
        ).rejects.toThrow();
      });

      it('should handle partial updates', async () => {
        // First set some data
        await storage.runs.update(createdRun.runId, {
          status: 'running',
          executionContext: { initial: 'context' },
        });

        // Then update only status
        const updated = await storage.runs.update(createdRun.runId, {
          status: 'completed',
        });

        expect(updated.status).toBe('completed');
        expect(updated.executionContext).toEqual({ initial: 'context' });
        expect(updated.completedAt).toBeInstanceOf(Date);
      });

      it('should handle large output values (>1048576 bytes)', async () => {
        // Generate a large string that exceeds 1MB (1048576 bytes)
        const largeString = 'x'.repeat(1048577); // 1MB + 1 byte
        const largeOutput = {
          largeData: largeString,
          metadata: {
            size: largeString.length,
            description: 'Large run output test data',
            timestamp: new Date().toISOString(),
            workflowResult: {
              processedRecords: 1000000,
              summary: 'Large dataset processing completed successfully',
            },
          },
        };

        const updated = await storage.runs.update(createdRun.runId, {
          status: 'completed',
          output: largeOutput,
        });

        expect(updated.output).toEqual(largeOutput);
        expect(updated.status).toBe('completed');
        expect(updated.completedAt).toBeInstanceOf(Date);

        // Verify the large data is preserved correctly
        const updatedOutput = updated.output as typeof largeOutput;
        expect(updatedOutput.largeData).toBe(largeString);
        expect(updatedOutput.largeData.length).toBe(1048577);
        expect(updatedOutput.metadata.size).toBe(1048577);

        // Verify we can retrieve the run with large output data
        const retrieved = await storage.runs.get(createdRun.runId);
        expect(retrieved.output).toEqual(largeOutput);
        const retrievedOutput = retrieved.output as typeof largeOutput;
        expect(retrievedOutput.largeData).toBe(largeString);
        expect(retrievedOutput.largeData.length).toBe(1048577);
        expect(retrievedOutput.metadata.workflowResult.processedRecords).toBe(1000000);
      });
    });

    describe('list', () => {
      beforeEach(async () => {
        // Create multiple runs for testing
        const runs = [
          {
            deploymentId: 'deployment-1',
            workflowName: 'workflow-a',
            input: ['data1'],
          },
          {
            deploymentId: 'deployment-1',
            workflowName: 'workflow-b',
            input: ['data2'],
          },
          {
            deploymentId: 'deployment-2',
            workflowName: 'workflow-a',
            input: ['data3'],
          },
        ];

        for (const run of runs) {
          await storage.runs.create(run);
        }
      });

      it('should list all runs when no filters are provided', async () => {
        const result = await storage.runs.list();

        expect(result.data).toHaveLength(3);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
        expect(result.data.map((run) => run.deploymentId)).toEqual([
          'deployment-2',
          'deployment-1',
          'deployment-1',
        ]);
      });

      it('should filter by workflow name', async () => {
        const result = await storage.runs.list({
          workflowName: 'workflow-a',
        });

        expect(result.data).toHaveLength(2);
        expect(result.data.map((run) => run.deploymentId)).toEqual([
          'deployment-2',
          'deployment-1',
        ]);
        expect(
          result.data.every((run) => run.workflowName === 'workflow-a')
        ).toBe(true);
      });

      it('should filter by status', async () => {
        // Update one run to have a different status
        const allRuns = await storage.runs.list();
        await storage.runs.update(allRuns.data[0].runId, { status: 'running' });

        const result = await storage.runs.list({ status: 'running' });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('running');
      });

      it('should filter by both workflow name and status', async () => {
        // Update workflow-a runs to have different statuses
        const allRuns = await storage.runs.list({ workflowName: 'workflow-a' });
        await storage.runs.update(allRuns.data[0].runId, { status: 'running' });

        const result = await storage.runs.list({
          workflowName: 'workflow-a',
          status: 'running',
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].workflowName).toBe('workflow-a');
        expect(result.data[0].status).toBe('running');
      });

      it('should handle pagination with limit', async () => {
        const result = await storage.runs.list({
          pagination: { limit: 2 },
        });

        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(true);
        expect(result.cursor).toBeDefined();
      });

      it('should handle pagination with cursor', async () => {
        const firstPage = await storage.runs.list({
          pagination: { limit: 2 },
        });

        const secondPage = await storage.runs.list({
          pagination: {
            limit: 2,
            cursor: firstPage.cursor ?? undefined,
          },
        });

        expect(secondPage.data).toHaveLength(1);
        expect(secondPage.hasMore).toBe(false);
        expect(secondPage.cursor).toBeNull();

        // Ensure no overlap between pages
        const firstPageIds = firstPage.data.map((run) => run.runId);
        const secondPageIds = secondPage.data.map((run) => run.runId);
        expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
      });

      it('should return empty result when no runs match filter', async () => {
        const result = await storage.runs.list({
          workflowName: 'non-existent-workflow',
        });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });

      it('should return empty result when no runs exist', async () => {
        // Create a fresh storage instance
        const freshStorage = await newStorage();

        const result = await freshStorage.runs.list();

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });
    });

    describe('cancel', () => {
      it('should cancel a workflow run', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const created = await storage.runs.create(createRequest);
        const cancelled = await storage.runs.cancel(created.runId);

        expect(cancelled.status).toBe('cancelled');
        expect(cancelled.completedAt).toBeInstanceOf(Date);
        expect(cancelled.updatedAt.getTime()).toBeGreaterThan(
          created.updatedAt.getTime()
        );
      });

      it('should throw error when trying to cancel non-existent run', async () => {
        await expect(storage.runs.cancel('co_z123')).rejects.toThrow();
      });
    });

    describe('pause', () => {
      it('should pause a workflow run', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const created = await storage.runs.create(createRequest);
        const paused = await storage.runs.pause(created.runId);

        expect(paused.status).toBe('paused');
        expect(paused.updatedAt.getTime()).toBeGreaterThan(
          created.updatedAt.getTime()
        );
        expect(paused.completedAt).toBeUndefined();
      });

      it('should throw error when trying to pause non-existent run', async () => {
        await expect(storage.runs.pause('co_z123')).rejects.toThrow();
      });
    });

    describe('resume', () => {
      it('should resume a paused workflow run', async () => {
        const createRequest = {
          deploymentId: 'test-deployment',
          workflowName: 'test-workflow',
          input: ['test', 'data'],
        };

        const created = await storage.runs.create(createRequest);
        const paused = await storage.runs.pause(created.runId);

        // Add a small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 1));

        const resumed = await storage.runs.resume(created.runId);

        expect(resumed.status).toBe('running');
        expect(resumed.startedAt).toBeInstanceOf(Date);
        expect(resumed.updatedAt.getTime()).toBeGreaterThanOrEqual(
          paused.updatedAt.getTime()
        );
      });

      it('should throw error when trying to resume non-existent run', async () => {
        await expect(storage.runs.resume('co_z123')).rejects.toThrow();
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete workflow lifecycle', async () => {
        // Create
        const created = await storage.runs.create({
          deploymentId: 'test-deployment',
          workflowName: 'lifecycle-test',
          input: ['start'],
        });

        expect(created.status).toBe('pending');

        // Start
        const started = await storage.runs.update(created.runId, {
          status: 'running',
        });
        expect(started.status).toBe('running');
        expect(started.startedAt).toBeDefined();

        // Pause
        const paused = await storage.runs.pause(created.runId);
        expect(paused.status).toBe('paused');

        // Resume
        const resumed = await storage.runs.resume(created.runId);
        expect(resumed.status).toBe('running');

        // Complete
        const completed = await storage.runs.update(created.runId, {
          status: 'completed',
          output: { result: 'success' },
        });
        expect(completed.status).toBe('completed');
        expect(completed.output).toEqual({ result: 'success' });
        expect(completed.completedAt).toBeDefined();
      });

      it('should handle error scenario', async () => {
        const created = await storage.runs.create({
          deploymentId: 'test-deployment',
          workflowName: 'error-test',
          input: ['will-fail'],
        });

        const failed = await storage.runs.update(created.runId, {
          status: 'failed',
          error: 'Runtime error occurred',
          errorCode: 'RUNTIME_ERROR',
        });

        expect(failed.status).toBe('failed');
        expect(failed.error).toBe('Runtime error occurred');
        expect(failed.errorCode).toBe('RUNTIME_ERROR');
        expect(failed.completedAt).toBeDefined();
      });

      it('should maintain data integrity across operations', async () => {
        const originalInput = ['complex', { nested: 'data' }, 42];
        const originalContext = { userId: 'user123', sessionId: 'session456' };

        const created = await storage.runs.create({
          deploymentId: 'test-deployment',
          workflowName: 'integrity-test',
          input: originalInput,
          executionContext: originalContext,
        });

        // Update status multiple times
        await storage.runs.update(created.runId, { status: 'running' });
        await storage.runs.update(created.runId, { status: 'completed' });

        const final = await storage.runs.get(created.runId);

        expect(final.input).toEqual(originalInput);
        expect(final.executionContext).toEqual(originalContext);
        expect(final.status).toBe('completed');
        expect(final.startedAt).toBeDefined();
        expect(final.completedAt).toBeDefined();
      });
    });
  });

  describe('steps', () => {
    let testRunId: string;

    beforeEach(async () => {
      // Create a test run to associate steps with
      const createdRun = await storage.runs.create({
        deploymentId: 'test-deployment',
        workflowName: 'test-workflow',
        input: ['test', 'data'],
      });
      testRunId = createdRun.runId;
    });

    describe('create', () => {
      it('should create a new step with all required fields', async () => {
        const createRequest = {
          stepId: 'step-1',
          stepName: 'test-step',
          input: ['arg1', 'arg2', { nested: 'object' }],
        };

        const result = await storage.steps.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          status: 'pending',
          attempt: 1,
          ...createRequest,
        });
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
        expect(result.startedAt).toBeUndefined();
        expect(result.completedAt).toBeUndefined();
        expect(result.output).toBeUndefined();
        expect(result.error).toBeUndefined();
        expect(result.errorCode).toBeUndefined();
      });

      it('should create a step with empty input array', async () => {
        const createRequest = {
          stepId: 'step-empty',
          stepName: 'empty-step',
          input: [],
        };

        const result = await storage.steps.create(testRunId, createRequest);

        expect(result.input).toEqual([]);
        expect(result.stepId).toBe('step-empty');
        expect(result.stepName).toBe('empty-step');
      });

      it('should handle complex JSON serializable input', async () => {
        const complexInput = [
          { nested: { deeply: { value: 42 } } },
          [1, 2, { mixed: 'array' }],
          null,
          true,
          3.14,
        ];

        const createRequest = {
          stepId: 'step-complex',
          stepName: 'complex-step',
          input: complexInput,
        };

        const result = await storage.steps.create(testRunId, createRequest);

        expect(result.input).toEqual(complexInput);
      });

      it('should create multiple steps for the same run', async () => {
        const step1 = await storage.steps.create(testRunId, {
          stepId: 'step-1',
          stepName: 'first-step',
          input: ['data1'],
        });

        const step2 = await storage.steps.create(testRunId, {
          stepId: 'step-2',
          stepName: 'second-step',
          input: ['data2'],
        });

        expect(step1.runId).toBe(testRunId);
        expect(step2.runId).toBe(testRunId);
        expect(step1.stepId).toBe('step-1');
        expect(step2.stepId).toBe('step-2');
        expect(step1.stepName).toBe('first-step');
        expect(step2.stepName).toBe('second-step');
      });
    });

    describe('get', () => {
      it('should retrieve an existing step', async () => {
        const createRequest = {
          stepId: 'step-1',
          stepName: 'test-step',
          input: ['test', 'data'],
        };

        const created = await storage.steps.create(testRunId, createRequest);
        const retrieved = await storage.steps.get(testRunId, created.stepId);

        expect(retrieved).toEqual(created);
      });

      it('should throw error when step does not exist', async () => {
        await expect(
          storage.steps.get(testRunId, 'non-existent-step')
        ).rejects.toThrow();
      });

      it('should throw error when run does not exist', async () => {
        await expect(
          storage.steps.get('non-existent-run', 'step-1')
        ).rejects.toThrow();
      });

      it('should retrieve step with all fields populated', async () => {
        const createRequest = {
          stepId: 'step-complete',
          stepName: 'complete-step',
          input: ['test'],
        };

        const created = await storage.steps.create(testRunId, createRequest);

        // Update the step to have all fields - first set to running to get startedAt
        await storage.steps.update(testRunId, created.stepId, {
          status: 'running',
        });

        const updated = await storage.steps.update(testRunId, created.stepId, {
          status: 'completed',
          output: { result: 'success' },
        });

        const retrieved = await storage.steps.get(testRunId, created.stepId);

        expect(retrieved).toEqual(updated);
        expect(retrieved.status).toBe('completed');
        expect(retrieved.output).toEqual({ result: 'success' });
        expect(retrieved.startedAt).toBeDefined();
        expect(retrieved.completedAt).toBeDefined();
      });
    });

    describe('update', () => {
      let createdStep: Step;

      beforeEach(async () => {
        const createRequest = {
          stepId: 'step-1',
          stepName: 'test-step',
          input: ['initial', 'data'],
        };
        createdStep = await storage.steps.create(testRunId, createRequest);
      });

      it('should update status to running and set startedAt', async () => {
        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'running',
          }
        );

        expect(updated.status).toBe('running');
        expect(updated.startedAt).toBeInstanceOf(Date);
        expect(updated.updatedAt.getTime()).toBeGreaterThan(
          createdStep.updatedAt.getTime()
        );
        expect(updated.completedAt).toBeUndefined();
      });

      it('should update status to completed and set completedAt', async () => {
        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'completed',
            output: { result: 'success' },
          }
        );

        expect(updated.status).toBe('completed');
        expect(updated.output).toEqual({ result: 'success' });
        expect(updated.completedAt).toBeInstanceOf(Date);
        expect(updated.updatedAt.getTime()).toBeGreaterThan(
          createdStep.updatedAt.getTime()
        );
      });

      it('should update status to failed and set completedAt', async () => {
        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'failed',
            error: 'Something went wrong',
            errorCode: 'RUNTIME_ERROR',
          }
        );

        expect(updated.status).toBe('failed');
        expect(updated.error).toBe('Something went wrong');
        expect(updated.errorCode).toBe('RUNTIME_ERROR');
        expect(updated.completedAt).toBeInstanceOf(Date);
      });

      it('should update status to cancelled and NOT set completedAt', async () => {
        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'cancelled',
          }
        );

        expect(updated.status).toBe('cancelled');
        expect(updated.completedAt).toBeUndefined();
      });

      it('should update multiple fields at once', async () => {
        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'running',
            output: { intermediate: 'result' },
          }
        );

        expect(updated.status).toBe('running');
        expect(updated.output).toEqual({ intermediate: 'result' });
        expect(updated.startedAt).toBeInstanceOf(Date);
      });

      it('should throw error when step does not exist', async () => {
        await expect(
          storage.steps.update(testRunId, 'non-existent-step', {
            status: 'running',
          })
        ).rejects.toThrow();
      });

      it('should throw error when run does not exist', async () => {
        await expect(
          storage.steps.update('non-existent-run', createdStep.stepId, {
            status: 'running',
          })
        ).rejects.toThrow();
      });

      it('should handle partial updates', async () => {
        // First set some data
        await storage.steps.update(testRunId, createdStep.stepId, {
          status: 'running',
          output: { initial: 'output' },
        });

        // Then update only status
        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'completed',
          }
        );

        expect(updated.status).toBe('completed');
        expect(updated.output).toEqual({ initial: 'output' });
        expect(updated.completedAt).toBeInstanceOf(Date);
      });

      it('should handle complex output data', async () => {
        const complexOutput = {
          nested: { deeply: { value: 42 } },
          array: [1, 2, { mixed: 'array' }],
          nullValue: null,
          booleanValue: true,
          numberValue: 3.14,
        };

        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'completed',
            output: complexOutput,
          }
        );

        expect(updated.output).toEqual(complexOutput);
      });

      it('should handle large output values (>1048576 bytes)', async () => {
        // Generate a large string that exceeds 1MB (1048576 bytes)
        const largeString = 'x'.repeat(1048577); // 1MB + 1 byte
        const largeOutput = {
          largeData: largeString,
          metadata: {
            size: largeString.length,
            description: 'Large output test data',
            timestamp: new Date().toISOString(),
          },
        };

        const updated = await storage.steps.update(
          testRunId,
          createdStep.stepId,
          {
            status: 'completed',
            output: largeOutput,
          }
        );

        expect(updated.output).toEqual(largeOutput);
        expect(updated.status).toBe('completed');
        expect(updated.completedAt).toBeInstanceOf(Date);

        // Verify the large data is preserved correctly
        const updatedOutput = updated.output as typeof largeOutput;
        expect(updatedOutput.largeData).toBe(largeString);
        expect(updatedOutput.largeData.length).toBe(1048577);
        expect(updatedOutput.metadata.size).toBe(1048577);

        // Verify we can retrieve the step with large output data
        const retrieved = await storage.steps.get(testRunId, createdStep.stepId);
        expect(retrieved.output).toEqual(largeOutput);
        const retrievedOutput = retrieved.output as typeof largeOutput;
        expect(retrievedOutput.largeData).toBe(largeString);
        expect(retrievedOutput.largeData.length).toBe(1048577);
      });
    });

    describe('list', () => {
      beforeEach(async () => {
        // Create multiple steps for testing
        const steps = [
          {
            stepId: 'step-1',
            stepName: 'first-step',
            input: ['data1'],
          },
          {
            stepId: 'step-2',
            stepName: 'second-step',
            input: ['data2'],
          },
          {
            stepId: 'step-3',
            stepName: 'third-step',
            input: ['data3'],
          },
        ];

        for (const step of steps) {
          await storage.steps.create(testRunId, step);
        }
      });

      it('should list all steps when no pagination is provided', async () => {
        const result = await storage.steps.list({ runId: testRunId });

        expect(result.data).toHaveLength(3);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
        expect(result.data.map((step) => step.stepId)).toEqual([
          'step-3',
          'step-2',
          'step-1',
        ]);
      });

      it('should handle pagination with limit', async () => {
        const result = await storage.steps.list({
          runId: testRunId,
          pagination: { limit: 2 },
        });

        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(true);
        expect(result.cursor).toBeDefined();
      });

      it('should handle pagination with cursor', async () => {
        const firstPage = await storage.steps.list({
          runId: testRunId,
          pagination: { limit: 2 },
        });

        const secondPage = await storage.steps.list({
          runId: testRunId,
          pagination: {
            limit: 2,
            cursor: firstPage.cursor ?? undefined,
          },
        });

        expect(secondPage.data).toHaveLength(1);
        expect(secondPage.hasMore).toBe(false);
        expect(secondPage.cursor).toBeNull();

        // Ensure no overlap between pages
        const firstPageIds = firstPage.data.map((step) => step.stepId);
        const secondPageIds = secondPage.data.map((step) => step.stepId);
        expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
      });

      it('should return empty result when no steps exist for run', async () => {
        // Create a fresh run with no steps
        const freshRun = await storage.runs.create({
          deploymentId: 'fresh-deployment',
          workflowName: 'fresh-workflow',
          input: ['fresh'],
        });

        const result = await storage.steps.list({ runId: freshRun.runId });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });

      it('should return empty result when run does not exist', async () => {
        const result = await storage.steps.list({ runId: 'non-existent-run' });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete step lifecycle', async () => {
        // Create
        const created = await storage.steps.create(testRunId, {
          stepId: 'lifecycle-step',
          stepName: 'lifecycle-test',
          input: ['start'],
        });

        expect(created.status).toBe('pending');

        // Start
        const started = await storage.steps.update(testRunId, created.stepId, {
          status: 'running',
        });
        expect(started.status).toBe('running');
        expect(started.startedAt).toBeDefined();

        // Complete
        const completed = await storage.steps.update(
          testRunId,
          created.stepId,
          {
            status: 'completed',
            output: { result: 'success' },
          }
        );
        expect(completed.status).toBe('completed');
        expect(completed.output).toEqual({ result: 'success' });
        expect(completed.completedAt).toBeDefined();
      });

      it('should handle error scenario', async () => {
        const created = await storage.steps.create(testRunId, {
          stepId: 'error-step',
          stepName: 'error-test',
          input: ['will-fail'],
        });

        const failed = await storage.steps.update(testRunId, created.stepId, {
          status: 'failed',
          error: 'Runtime error occurred',
          errorCode: 'RUNTIME_ERROR',
        });

        expect(failed.status).toBe('failed');
        expect(failed.error).toBe('Runtime error occurred');
        expect(failed.errorCode).toBe('RUNTIME_ERROR');
        expect(failed.completedAt).toBeDefined();
      });

      it('should maintain data integrity across operations', async () => {
        const originalInput = ['complex', { nested: 'data' }, 42];

        const created = await storage.steps.create(testRunId, {
          stepId: 'integrity-step',
          stepName: 'integrity-test',
          input: originalInput,
        });

        // Update status multiple times
        await storage.steps.update(testRunId, created.stepId, {
          status: 'running',
        });
        await storage.steps.update(testRunId, created.stepId, {
          status: 'completed',
        });

        const final = await storage.steps.get(testRunId, created.stepId);

        expect(final.input).toEqual(originalInput);
        expect(final.status).toBe('completed');
        expect(final.startedAt).toBeDefined();
        expect(final.completedAt).toBeDefined();
      });

      it('should handle multiple steps in same run with different statuses', async () => {
        const step1 = await storage.steps.create(testRunId, {
          stepId: 'multi-step-1',
          stepName: 'first-multi-step',
          input: ['data1'],
        });

        const step2 = await storage.steps.create(testRunId, {
          stepId: 'multi-step-2',
          stepName: 'second-multi-step',
          input: ['data2'],
        });

        // Update step1 to completed
        await storage.steps.update(testRunId, step1.stepId, {
          status: 'completed',
          output: { result1: 'success' },
        });

        // Update step2 to failed
        await storage.steps.update(testRunId, step2.stepId, {
          status: 'failed',
          error: 'Step 2 failed',
        });

        // List all steps and verify their statuses
        const allSteps = await storage.steps.list({ runId: testRunId });
        const completedStep = allSteps.data.find(
          (s) => s.stepId === 'multi-step-1'
        );
        const failedStep = allSteps.data.find(
          (s) => s.stepId === 'multi-step-2'
        );

        expect(completedStep?.status).toBe('completed');
        expect(completedStep?.output).toEqual({ result1: 'success' });
        expect(failedStep?.status).toBe('failed');
        expect(failedStep?.error).toBe('Step 2 failed');
      });
    });
  });

  describe('events', () => {
    let testRunId: string;

    beforeEach(async () => {
      // Create a test run to associate events with
      const createdRun = await storage.runs.create({
        deploymentId: 'test-deployment',
        workflowName: 'test-workflow',
        input: ['test', 'data'],
      });
      testRunId = createdRun.runId;
    });

    describe('ID conversion behavior', () => {
      it('should create event with evnt_ prefix in returned eventId', async () => {
        const createRequest = {
          eventType: 'step_completed' as const,
          correlationId: 'corr-123',
          eventData: { result: 'success' },
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result.eventId).toMatch(/^evnt_/);
      });

      it('should list events with evnt_ prefix in returned eventIds', async () => {
        const createRequest = {
          eventType: 'step_completed' as const,
          correlationId: 'corr-123',
          eventData: { result: 'success' },
        };

        await storage.events.create(testRunId, createRequest);
        const listResult = await storage.events.list({ runId: testRunId });

        expect(listResult.data).toHaveLength(1);
        expect(listResult.data[0].eventId).toMatch(/^evnt_/);
      });
    });

    describe('create', () => {
      it('should create a step_completed event with all required fields', async () => {
        const createRequest = {
          eventType: 'step_completed' as const,
          correlationId: 'corr-123',
          eventData: {
            result: { success: true, data: 'processed' },
          },
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a step_failed event with error data', async () => {
        const createRequest = {
          eventType: 'step_failed' as const,
          correlationId: 'corr-456',
          eventData: {
            error: { message: 'Something went wrong', code: 'ERROR_001' },
            stack: 'Error stack trace...',
            fatal: true,
          },
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a step_started event without eventData', async () => {
        const createRequest = {
          eventType: 'step_started' as const,
          correlationId: 'corr-789',
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a hook_created event', async () => {
        const createRequest = {
          eventType: 'hook_created' as const,
          correlationId: 'hook-corr-123',
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a hook_received event with payload data', async () => {
        const createRequest = {
          eventType: 'hook_received' as const,
          correlationId: 'hook-req-456',
          eventData: {
            payload: {
              message: 'Hello from hook',
              timestamp: 1234567890,
              data: { key: 'value' },
            },
          },
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a step_retrying event with attempt data', async () => {
        const createRequest = {
          eventType: 'step_retrying' as const,
          correlationId: 'retry-corr-789',
          eventData: {
            error: { message: 'Temporary failure' },
            attempt: 2,
          },
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a workflow_started event', async () => {
        const createRequest = {
          eventType: 'workflow_started' as const,
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a workflow_completed event', async () => {
        const createRequest = {
          eventType: 'workflow_completed' as const,
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a workflow_failed event with error data', async () => {
        const createRequest = {
          eventType: 'workflow_failed' as const,
          eventData: {
            error: {
              message: 'Workflow execution failed',
              code: 'WORKFLOW_ERROR',
            },
          },
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a hook_disposed event', async () => {
        const createRequest = {
          eventType: 'hook_disposed' as const,
          correlationId: 'dispose-corr-123',
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          ...createRequest,
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create multiple events for the same run', async () => {
        const event1 = await storage.events.create(testRunId, {
          eventType: 'step_started',
          correlationId: 'step-1',
        });

        const event2 = await storage.events.create(testRunId, {
          eventType: 'step_completed',
          correlationId: 'step-1',
          eventData: {
            result: { success: true },
          },
        });

        expect(event1.runId).toBe(testRunId);
        expect(event2.runId).toBe(testRunId);
        expect(event1.eventType).toBe('step_started');
        expect(event2.eventType).toBe('step_completed');
        expect(event1.eventId).not.toBe(event2.eventId);
      });

      it('should handle complex event data structures', async () => {
        const complexEventData = {
          result: {
            nested: {
              deeply: {
                value: 42,
                array: [1, 2, { mixed: 'array' }],
                nullValue: null,
                booleanValue: true,
                numberValue: 3.14,
              },
            },
          },
        };

        const createRequest = {
          eventType: 'step_completed' as const,
          correlationId: 'complex-corr',
          eventData: complexEventData,
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect((result as any).eventData).toEqual(complexEventData);
      });

      it('should handle large eventData values (>1048576 bytes)', async () => {
        // Generate a large string that exceeds 1MB (1048576 bytes)
        const largeString = 'x'.repeat(1048577); // 1MB + 1 byte
        const largeEventData = {
          result: {
            largeData: largeString,
            metadata: {
              size: largeString.length,
              description: 'Large event data test',
              timestamp: new Date().toISOString(),
              eventDetails: {
                processingTime: 5000,
                recordsProcessed: 1000000,
                summary: 'Large dataset processing event completed successfully',
              },
            },
          },
        };

        const createRequest = {
          eventType: 'step_completed' as const,
          correlationId: 'large-data-corr',
          eventData: largeEventData,
        };

        const result = await storage.events.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          eventType: 'step_completed',
          correlationId: 'large-data-corr',
        });
        expect(result.eventId).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);

        // Verify the large data is preserved correctly
        expect((result as any).eventData).toEqual(largeEventData);
        const resultEventData = (result as any).eventData as typeof largeEventData;
        expect(resultEventData.result.largeData).toBe(largeString);
        expect(resultEventData.result.largeData.length).toBe(1048577);
        expect(resultEventData.result.metadata.size).toBe(1048577);
        expect(resultEventData.result.metadata.eventDetails.recordsProcessed).toBe(1000000);

        // Verify we can retrieve the event with large eventData through listing
        const events = await storage.events.list({ runId: testRunId });
        const createdEvent = events.data.find(e => e.eventId === result.eventId);
        expect(createdEvent).toBeDefined();

        expect((createdEvent as any)?.eventData).toEqual(largeEventData);
        const retrievedEventData = (createdEvent as any)?.eventData as typeof largeEventData;
        expect(retrievedEventData.result.largeData).toBe(largeString);
        expect(retrievedEventData.result.largeData.length).toBe(1048577);
        expect(retrievedEventData.result.metadata.size).toBe(1048577);
      });
    });

    describe('list', () => {
      beforeEach(async () => {
        // Create multiple events for testing
        const events = [
          {
            eventType: 'workflow_started' as const,
          },
          {
            eventType: 'step_started' as const,
            correlationId: 'step-1',
          },
          {
            eventType: 'step_completed' as const,
            correlationId: 'step-1',
            eventData: {
              result: { success: true },
            },
          },
          {
            eventType: 'step_started' as const,
            correlationId: 'step-2',
          },
          {
            eventType: 'step_failed' as const,
            correlationId: 'step-2',
            eventData: {
              error: { message: 'Step failed' },
              fatal: false,
            },
          },
        ];

        for (const event of events) {
          await storage.events.create(testRunId, event);
        }
      });

      it('should list all events when no pagination is provided', async () => {
        const result = await storage.events.list({ runId: testRunId });

        expect(result.data).toHaveLength(5);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
        expect(result.data.map((event) => event.eventType)).toEqual([
          'workflow_started',
          'step_started',
          'step_completed',
          'step_started',
          'step_failed',
        ]);
      });

      it('should handle pagination with limit', async () => {
        const result = await storage.events.list({
          runId: testRunId,
          pagination: { limit: 3 },
        });

        expect(result.data).toHaveLength(3);
        expect(result.hasMore).toBe(true);
        expect(result.cursor).toBeDefined();
      });

      it('should handle pagination with cursor', async () => {
        const firstPage = await storage.events.list({
          runId: testRunId,
          pagination: { limit: 3 },
        });

        const secondPage = await storage.events.list({
          runId: testRunId,
          pagination: {
            limit: 3,
            cursor: firstPage.cursor ?? undefined,
          },
        });

        expect(secondPage.data).toHaveLength(2);
        expect(secondPage.hasMore).toBe(false);
        expect(secondPage.cursor).toBeNull();

        // Ensure no overlap between pages
        const firstPageIds = firstPage.data.map((event) => event.eventId);
        const secondPageIds = secondPage.data.map((event) => event.eventId);
        expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
      });

      it('should return empty result when no events exist for run', async () => {
        // Create a fresh run with no events
        const freshRun = await storage.runs.create({
          deploymentId: 'fresh-deployment',
          workflowName: 'fresh-workflow',
          input: ['fresh'],
        });

        const result = await storage.events.list({ runId: freshRun.runId });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });

      it('should return empty result when run does not exist', async () => {
        const result = await storage.events.list({ runId: 'non-existent-run' });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });

      it('should maintain chronological order of events', async () => {
        const result = await storage.events.list({ runId: testRunId });

        // Events should be in the order they were created
        expect(result.data[0].eventType).toBe('workflow_started');
        expect(result.data[1].eventType).toBe('step_started');
        expect(result.data[1].correlationId).toBe('step-1');
        expect(result.data[2].eventType).toBe('step_completed');
        expect(result.data[2].correlationId).toBe('step-1');
        expect(result.data[3].eventType).toBe('step_started');
        expect(result.data[3].correlationId).toBe('step-2');
        expect(result.data[4].eventType).toBe('step_failed');
        expect(result.data[4].correlationId).toBe('step-2');
      });
    });

    describe('listByCorrelationId', () => {
      let testRunId1: string;
      let testRunId2: string;

      beforeEach(async () => {
        // Create two test runs to test cross-run correlation
        const run1 = await storage.runs.create({
          deploymentId: 'test-deployment-1',
          workflowName: 'test-workflow-1',
          input: ['test', 'data'],
        });
        testRunId1 = run1.runId;

        const run2 = await storage.runs.create({
          deploymentId: 'test-deployment-2',
          workflowName: 'test-workflow-2',
          input: ['test', 'data'],
        });
        testRunId2 = run2.runId;

        // Create events with different correlation IDs across both runs
        const events = [
          // Events for correlation ID 'corr-1' across both runs
          {
            runId: testRunId1,
            eventType: 'step_started' as const,
            correlationId: 'corr-1',
          },
          {
            runId: testRunId1,
            eventType: 'step_completed' as const,
            correlationId: 'corr-1',
            eventData: { result: 'success-1' },
          },
          {
            runId: testRunId2,
            eventType: 'step_started' as const,
            correlationId: 'corr-1',
          },
          {
            runId: testRunId2,
            eventType: 'step_failed' as const,
            correlationId: 'corr-1',
            eventData: { error: 'failed-1' },
          },
          // Events for correlation ID 'corr-2' in run1 only
          {
            runId: testRunId1,
            eventType: 'step_started' as const,
            correlationId: 'corr-2',
          },
          {
            runId: testRunId1,
            eventType: 'step_completed' as const,
            correlationId: 'corr-2',
            eventData: { result: 'success-2' },
          },
          // Events without correlation ID
          {
            runId: testRunId1,
            eventType: 'workflow_started' as const,
          },
          {
            runId: testRunId2,
            eventType: 'workflow_completed' as const,
          },
        ];

        for (const event of events) {
          await storage.events.create(event.runId, event);
        }
      });

      it('should list all events with matching correlation ID across all runs', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
        });

        expect(result.data).toHaveLength(4);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();

        // Verify all events have the correct correlation ID
        expect(
          result.data.every((event) => event.correlationId === 'corr-1')
        ).toBe(true);

        // Verify events come from both runs
        const runIds = result.data.map((event) => event.runId);
        expect(runIds).toContain(testRunId1);
        expect(runIds).toContain(testRunId2);

        // Verify event types
        const eventTypes = result.data.map((event) => event.eventType);
        expect(eventTypes).toContain('step_started');
        expect(eventTypes).toContain('step_completed');
        expect(eventTypes).toContain('step_failed');
      });

      it('should list events with correlation ID from single run', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-2',
        });

        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();

        // Verify all events have the correct correlation ID
        expect(
          result.data.every((event) => event.correlationId === 'corr-2')
        ).toBe(true);

        // Verify all events come from the same run
        expect(result.data.every((event) => event.runId === testRunId1)).toBe(
          true
        );

        // Verify event types
        const eventTypes = result.data.map((event) => event.eventType);
        expect(eventTypes).toContain('step_started');
        expect(eventTypes).toContain('step_completed');
      });

      it('should return empty result when no events match correlation ID', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'non-existent-corr',
        });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });

      it('should handle pagination with limit', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
          pagination: { limit: 2 },
        });

        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(true);
        expect(result.cursor).toBeDefined();

        // Verify all returned events have the correct correlation ID
        expect(
          result.data.every((event) => event.correlationId === 'corr-1')
        ).toBe(true);
      });

      it('should handle pagination with cursor', async () => {
        const firstPage = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
          pagination: { limit: 2 },
        });

        const secondPage = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
          pagination: {
            limit: 2,
            cursor: firstPage.cursor ?? undefined,
          },
        });

        expect(secondPage.data).toHaveLength(2);
        expect(secondPage.hasMore).toBe(false);
        expect(secondPage.cursor).toBeNull();

        // Ensure no overlap between pages
        const firstPageIds = firstPage.data.map((event) => event.eventId);
        const secondPageIds = secondPage.data.map((event) => event.eventId);
        expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));

        // Verify all events in both pages have the correct correlation ID
        expect(
          [...firstPage.data, ...secondPage.data].every(
            (event) => event.correlationId === 'corr-1'
          )
        ).toBe(true);
      });

      it('should sort events in ascending chronological order by default', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
        });

        expect(result.data).toHaveLength(4);

        // Verify events are sorted by createdAt in ascending order
        for (let i = 1; i < result.data.length; i++) {
          expect(result.data[i].createdAt.getTime()).toBeGreaterThanOrEqual(
            result.data[i - 1].createdAt.getTime()
          );
        }
      });

      it('should sort events in descending chronological order when specified', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
          pagination: { sortOrder: 'desc' },
        });

        expect(result.data).toHaveLength(4);

        // Verify events are sorted by createdAt in descending order
        for (let i = 1; i < result.data.length; i++) {
          expect(result.data[i].createdAt.getTime()).toBeLessThanOrEqual(
            result.data[i - 1].createdAt.getTime()
          );
        }
      });

      it('should exclude eventData when resolveData is none', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
          resolveData: 'none',
        });

        expect(result.data).toHaveLength(4);

        // Verify eventData is excluded from all events
        result.data.forEach((event) => {
          expect((event as any).eventData).toBeUndefined();
        });

        // Verify other properties are still present
        expect(result.data[0].eventId).toBeDefined();
        expect(result.data[0].eventType).toBeDefined();
        expect(result.data[0].correlationId).toBe('corr-1');
        expect(result.data[0].runId).toBeDefined();
        expect(result.data[0].createdAt).toBeDefined();
      });

      it('should include eventData when resolveData is not specified', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
        });

        expect(result.data).toHaveLength(4);

        // Verify eventData is included for events that have it
        const eventsWithData = result.data.filter(
          (event) =>
            event.eventType === 'step_completed' ||
            event.eventType === 'step_failed'
        );

        eventsWithData.forEach((event) => {
          expect((event as any).eventData).toBeDefined();
        });
      });

      it('should handle complex event data structures', async () => {
        // Create an event with complex data
        await storage.events.create(testRunId1, {
          eventType: 'step_completed',
          correlationId: 'complex-corr',
          eventData: {
            result: {
              nested: {
                deeply: {
                  value: 42,
                  array: [1, 2, { mixed: 'array' }],
                  nullValue: null,
                  booleanValue: true,
                  numberValue: 3.14,
                },
              },
            },
          },
        });

        const result = await storage.events.listByCorrelationId({
          correlationId: 'complex-corr',
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].correlationId).toBe('complex-corr');

        const eventData = (result.data[0] as any).eventData;
        expect(eventData.result.nested.deeply.value).toBe(42);
        expect(eventData.result.nested.deeply.array).toEqual([
          1,
          2,
          { mixed: 'array' },
        ]);
        expect(eventData.result.nested.deeply.nullValue).toBeNull();
        expect(eventData.result.nested.deeply.booleanValue).toBe(true);
        expect(eventData.result.nested.deeply.numberValue).toBe(3.14);
      });

      it('should handle events with no correlation ID', async () => {
        // Events without correlation ID should not be returned
        const result = await storage.events.listByCorrelationId({
          correlationId: 'corr-1',
        });

        // Should only return events with correlation ID 'corr-1'
        expect(
          result.data.every((event) => event.correlationId === 'corr-1')
        ).toBe(true);

        // Should not include workflow_started or workflow_completed events
        const eventTypes = result.data.map((event) => event.eventType);
        expect(eventTypes).not.toContain('workflow_started');
        expect(eventTypes).not.toContain('workflow_completed');
      });

      it('should handle empty correlation ID', async () => {
        const result = await storage.events.listByCorrelationId({
          correlationId: '',
        });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();
      });

      it('should maintain chronological order across different runs', async () => {
        // Add a delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Create events in different runs with same correlation ID
        await storage.events.create(testRunId1, {
          eventType: 'step_started',
          correlationId: 'chrono-test',
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        await storage.events.create(testRunId2, {
          eventType: 'step_started',
          correlationId: 'chrono-test',
        });

        const result = await storage.events.listByCorrelationId({
          correlationId: 'chrono-test',
        });

        expect(result.data).toHaveLength(2);

        // Verify chronological order is maintained
        expect(result.data[0].createdAt.getTime()).toBeLessThanOrEqual(
          result.data[1].createdAt.getTime()
        );
      });

      it('should handle large number of events with same correlation ID', async () => {
        // Create many events with the same correlation ID
        const eventCount = 10;
        for (let i = 0; i < eventCount; i++) {
          await storage.events.create(testRunId1, {
            eventType: 'step_started',
            correlationId: 'bulk-corr',
          });
        }

        const result = await storage.events.listByCorrelationId({
          correlationId: 'bulk-corr',
        });

        expect(result.data).toHaveLength(eventCount);
        expect(
          result.data.every((event) => event.correlationId === 'bulk-corr')
        ).toBe(true);
        expect(result.data.every((event) => event.runId === testRunId1)).toBe(
          true
        );
      });

      it('should handle pagination with large dataset', async () => {
        // Create many events with the same correlation ID
        const eventCount = 15;
        for (let i = 0; i < eventCount; i++) {
          await storage.events.create(testRunId1, {
            eventType: 'step_started',
            correlationId: 'pagination-test',
          });
        }

        const firstPage = await storage.events.listByCorrelationId({
          correlationId: 'pagination-test',
          pagination: { limit: 5 },
        });

        expect(firstPage.data).toHaveLength(5);
        expect(firstPage.hasMore).toBe(true);
        expect(firstPage.cursor).toBeDefined();

        const secondPage = await storage.events.listByCorrelationId({
          correlationId: 'pagination-test',
          pagination: {
            limit: 5,
            cursor: firstPage.cursor ?? undefined,
          },
        });

        expect(secondPage.data).toHaveLength(5);
        expect(secondPage.hasMore).toBe(true);

        const thirdPage = await storage.events.listByCorrelationId({
          correlationId: 'pagination-test',
          pagination: {
            limit: 5,
            cursor: secondPage.cursor ?? undefined,
          },
        });

        expect(thirdPage.data).toHaveLength(5);
        expect(thirdPage.hasMore).toBe(false);
        expect(thirdPage.cursor).toBeNull();

        // Verify total count
        const totalEvents = [
          ...firstPage.data,
          ...secondPage.data,
          ...thirdPage.data,
        ];
        expect(totalEvents).toHaveLength(15);

        // Verify no duplicates
        const eventIds = totalEvents.map((event) => event.eventId);
        const uniqueEventIds = new Set(eventIds);
        expect(uniqueEventIds.size).toBe(15);
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete workflow event sequence', async () => {
        // Workflow starts
        await storage.events.create(testRunId, {
          eventType: 'workflow_started',
        });

        // Step 1 starts and completes
        await storage.events.create(testRunId, {
          eventType: 'step_started',
          correlationId: 'step-1',
        });

        await storage.events.create(testRunId, {
          eventType: 'step_completed',
          correlationId: 'step-1',
          eventData: {
            result: { processed: 'data-1' },
          },
        });

        // Step 2 starts and fails
        await storage.events.create(testRunId, {
          eventType: 'step_started',
          correlationId: 'step-2',
        });

        await storage.events.create(testRunId, {
          eventType: 'step_failed',
          correlationId: 'step-2',
          eventData: {
            error: { message: 'Step 2 failed' },
            fatal: true,
          },
        });

        // Workflow fails
        await storage.events.create(testRunId, {
          eventType: 'workflow_failed',
          eventData: {
            error: { message: 'Workflow failed due to step 2' },
          },
        });

        // List all events and verify sequence
        const allEvents = await storage.events.list({ runId: testRunId });

        expect(allEvents.data).toHaveLength(6);
        expect(allEvents.data[0].eventType).toBe('workflow_started');
        expect(allEvents.data[1].eventType).toBe('step_started');
        expect(allEvents.data[1].correlationId).toBe('step-1');
        expect(allEvents.data[2].eventType).toBe('step_completed');
        expect(allEvents.data[2].correlationId).toBe('step-1');
        expect(allEvents.data[3].eventType).toBe('step_started');
        expect(allEvents.data[3].correlationId).toBe('step-2');
        expect(allEvents.data[4].eventType).toBe('step_failed');
        expect(allEvents.data[4].correlationId).toBe('step-2');
        expect(allEvents.data[5].eventType).toBe('workflow_failed');
      });

      it('should maintain data integrity across multiple runs', async () => {
        // Create another run
        const secondRun = await storage.runs.create({
          deploymentId: 'second-deployment',
          workflowName: 'second-workflow',
          input: ['second-data'],
        });

        // Create events for both runs
        await storage.events.create(testRunId, {
          eventType: 'workflow_started',
        });

        await storage.events.create(secondRun.runId, {
          eventType: 'workflow_started',
        });

        await storage.events.create(testRunId, {
          eventType: 'workflow_completed',
        });

        await storage.events.create(secondRun.runId, {
          eventType: 'workflow_failed',
          eventData: {
            error: { message: 'Second workflow failed' },
          },
        });

        // List events for each run separately
        const firstRunEvents = await storage.events.list({ runId: testRunId });
        const secondRunEvents = await storage.events.list({
          runId: secondRun.runId,
        });

        expect(firstRunEvents.data).toHaveLength(2);
        expect(firstRunEvents.data[0].eventType).toBe('workflow_started');
        expect(firstRunEvents.data[1].eventType).toBe('workflow_completed');
        expect(firstRunEvents.data.every((e) => e.runId === testRunId)).toBe(
          true
        );

        expect(secondRunEvents.data).toHaveLength(2);
        expect(secondRunEvents.data[0].eventType).toBe('workflow_started');
        expect(secondRunEvents.data[1].eventType).toBe('workflow_failed');
        expect(
          secondRunEvents.data.every((e) => e.runId === secondRun.runId)
        ).toBe(true);
      });
    });
  });

  describe('hooks', () => {
    let testRunId: string;

    beforeEach(async () => {
      // Create a test run to associate hooks with
      const createdRun = await storage.runs.create({
        deploymentId: 'test-deployment',
        workflowName: 'test-workflow',
        input: ['test', 'data'],
      });
      testRunId = createdRun.runId;
    });

    describe('create', () => {
      it('should create a hook with all required fields', async () => {
        const createRequest = {
          hookId: 'hook-1',
          token: 'test-token-123',
        };

        const result = await storage.hooks.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          hookId: 'hook-1',
          token: 'test-token-123',
          ownerId: 'jazz-owner',
          projectId: 'jazz-project',
          environment: 'jazz',
        });
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create a hook with optional response', async () => {
        const createRequest = {
          hookId: 'hook-with-response',
          token: 'token-456',
          response: { status: 'success', data: { message: 'Hello' } },
        };

        const result = await storage.hooks.create(testRunId, createRequest);

        expect(result).toMatchObject({
          runId: testRunId,
          hookId: 'hook-with-response',
          token: 'token-456',
        });
        // Note: response is stored internally but not returned in Hook type
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should create multiple hooks for the same run', async () => {
        const hook1 = await storage.hooks.create(testRunId, {
          hookId: 'hook-1',
          token: 'token-1',
        });

        const hook2 = await storage.hooks.create(testRunId, {
          hookId: 'hook-2',
          token: 'token-2',
        });

        expect(hook1.runId).toBe(testRunId);
        expect(hook2.runId).toBe(testRunId);
        expect(hook1.hookId).toBe('hook-1');
        expect(hook2.hookId).toBe('hook-2');
        expect(hook1.token).toBe('token-1');
        expect(hook2.token).toBe('token-2');
      });

      it('should handle complex response data', async () => {
        const complexResponse = {
          user: {
            id: 'user-123',
            name: 'John Doe',
            preferences: {
              notifications: true,
              theme: 'dark',
            },
          },
          metadata: [
            { key: 'version', value: '1.0' },
            { key: 'environment', value: 'production' },
          ],
        };

        const createRequest = {
          hookId: 'hook-complex',
          token: 'complex-token',
          response: complexResponse,
        };

        const result = await storage.hooks.create(testRunId, createRequest);

        // Note: response is stored internally but not returned in Hook type
        expect(result).toMatchObject({
          runId: testRunId,
          hookId: 'hook-complex',
          token: 'complex-token',
        });
      });
    });

    describe('getByToken', () => {
      it('should retrieve an existing hook by token', async () => {
        const createRequest = {
          hookId: 'hook-1',
          token: 'get-token-123',
        };

        const created = await storage.hooks.create(testRunId, createRequest);
        const retrieved = await storage.hooks.getByToken('get-token-123');

        expect(retrieved).toEqual(created);
      });

      it('should throw error when hook with token does not exist', async () => {
        await expect(
          storage.hooks.getByToken('non-existent-token')
        ).rejects.toThrow('Hook with token non-existent-token not found');
      });

      it('should retrieve hook with response stored internally', async () => {
        const createRequest = {
          hookId: 'hook-with-response',
          token: 'response-token',
          response: { message: 'Test response', code: 200 },
        };

        const created = await storage.hooks.create(testRunId, createRequest);
        const retrieved = await storage.hooks.getByToken('response-token');

        expect(retrieved).toEqual(created);
        // Note: response is stored internally but not returned in Hook type
      });
    });

    describe('dispose', () => {
      it('should dispose an existing hook by hookId', async () => {
        const createRequest = {
          hookId: 'hook-to-dispose',
          token: 'dispose-token',
        };

        const created = await storage.hooks.create(testRunId, createRequest);
        const disposed = await storage.hooks.dispose('hook-to-dispose');

        expect(disposed).toEqual(created);

        // Verify hook is no longer retrievable by token
        await expect(
          storage.hooks.getByToken('dispose-token')
        ).rejects.toThrow();
      });

      it('should throw error when trying to dispose non-existent hook', async () => {
        await expect(
          storage.hooks.dispose('non-existent-hook')
        ).rejects.toThrow('Hook non-existent-hook not found');
      });

      it('should dispose one hook while keeping others', async () => {
        await storage.hooks.create(testRunId, {
          hookId: 'hook-dispose-1',
          token: 'token-dispose-1',
        });

        const hook2 = await storage.hooks.create(testRunId, {
          hookId: 'hook-dispose-2',
          token: 'token-dispose-2',
        });

        // Dispose one hook
        const disposed = await storage.hooks.dispose('hook-dispose-1');
        expect(disposed.hookId).toBe('hook-dispose-1');

        // Verify first hook is gone
        await expect(
          storage.hooks.getByToken('token-dispose-1')
        ).rejects.toThrow();

        // Verify second hook still exists
        const retrieved = await storage.hooks.getByToken('token-dispose-2');
        expect(retrieved).toEqual(hook2);
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete hook lifecycle', async () => {
        // Create hook
        const created = await storage.hooks.create(testRunId, {
          hookId: 'lifecycle-hook',
          token: 'lifecycle-token',
          metadata: { response: { message: 'Initial response' } },
        });

        expect(created.hookId).toBe('lifecycle-hook');
        expect(created.token).toBe('lifecycle-token');

        // Retrieve hook by token
        const retrieved = await storage.hooks.getByToken('lifecycle-token');
        expect(retrieved).toEqual(created);

        // Dispose hook
        const disposed = await storage.hooks.dispose('lifecycle-hook');
        expect(disposed.hookId).toBe('lifecycle-hook');

        // Verify hook is gone
        await expect(
          storage.hooks.getByToken('lifecycle-token')
        ).rejects.toThrow();
      });

      it('should maintain data integrity across multiple runs', async () => {
        // Create another run
        const secondRun = await storage.runs.create({
          deploymentId: 'second-deployment',
          workflowName: 'second-workflow',
          input: ['second-data'],
        });

        // Create hooks for both runs
        const hook1 = await storage.hooks.create(testRunId, {
          hookId: 'run1-hook',
          token: 'run1-token',
        });

        const hook2 = await storage.hooks.create(secondRun.runId, {
          hookId: 'run2-hook',
          token: 'run2-token',
        });

        // Verify hooks are isolated by run
        expect(hook1.runId).toBe(testRunId);
        expect(hook2.runId).toBe(secondRun.runId);

        // Verify hooks can be retrieved independently
        const retrieved1 = await storage.hooks.getByToken('run1-token');
        const retrieved2 = await storage.hooks.getByToken('run2-token');

        expect(retrieved1.runId).toBe(testRunId);
        expect(retrieved2.runId).toBe(secondRun.runId);
      });

      it('should support hooks with varying response complexity', async () => {
        const simpleHook = await storage.hooks.create(testRunId, {
          hookId: 'simple-hook',
          token: 'simple-token',
        });

        const complexHook = await storage.hooks.create(testRunId, {
          hookId: 'complex-hook',
          token: 'complex-token',
          metadata: {
            response: {
              nested: {
                deeply: {
                  value: 42,
                  array: [1, 2, { mixed: 'content' }],
                },
              },
            },
          },
        });

        // Verify both can be retrieved
        const retrievedSimple = await storage.hooks.getByToken('simple-token');
        const retrievedComplex =
          await storage.hooks.getByToken('complex-token');

        expect(retrievedSimple).toEqual(simpleHook);
        expect(retrievedComplex).toEqual(complexHook);
        // Note: response is stored internally but not returned in Hook type
      });
    });
  });
});
