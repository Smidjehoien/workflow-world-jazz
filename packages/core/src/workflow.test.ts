import { types } from 'node:util';
import { assert, describe, expect, it } from 'vitest';
import type { Event, WorkflowRun } from './backend.js';
import { runWorkflow } from './workflow.js';

describe('runWorkflow', () => {
  describe('successful workflow execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const workflowCode = 'function workflow() { return "success"; }';

      const workflowRun: WorkflowRun = {
        id: 'test-run-123',
        workflow_name: 'workflow',
        status: 'running',
        input: [],
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      const result = await runWorkflow(workflowCode, workflowRun, events);
      expect(result).toEqual('success');
    });

    it('should execute workflow with arguments', async () => {
      const workflowCode = 'function workflow(a, b) { return a + b; }';

      const workflowRun: WorkflowRun = {
        id: 'test-run-123',
        workflow_name: 'workflow',
        status: 'running',
        input: [1, 2],
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      const result = await runWorkflow(workflowCode, workflowRun, events);
      expect(result).toEqual(3);
    });

    it('allow user code to handle user-defined errors', async () => {
      const workflowCode = `function workflow() {
        try {
          throw new TypeError("my workflow error");
        } catch (err) {
          return err;
        }
      }`;

      const workflowRun: WorkflowRun = {
        id: 'test-run-123',
        workflow_name: 'workflow',
        status: 'running',
        input: [],
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      const result = await runWorkflow(workflowCode, workflowRun, events);
      assert(types.isNativeError(result));
      expect(result.name).toEqual('TypeError');
      expect(result.message).toEqual('my workflow error');
    });
  });

  describe('error handling', () => {
    it('should throw ReferenceError when workflow code does not return a function', async () => {
      let error: Error | undefined;
      try {
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'value',
          status: 'running',
          input: [],
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          updated_at: new Date('2024-01-01T00:00:00.000Z'),
          started_at: new Date('2024-01-01T00:00:00.000Z'),
          owner_id: 'test-owner',
          project_id: 'test-project',
          environment: 'test',
        };

        const events: Event[] = [];

        await runWorkflow('const value = "test"', workflowRun, events);
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('ReferenceError');
      expect(error.message).toEqual(
        'Workflow "value" must be a function, but got "string" instead'
      );
    });

    it('should throw user-defined error when workflow code throws an error', async () => {
      let error: Error | undefined;
      try {
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: [],
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          updated_at: new Date('2024-01-01T00:00:00.000Z'),
          started_at: new Date('2024-01-01T00:00:00.000Z'),
          owner_id: 'test-owner',
          project_id: 'test-project',
          environment: 'test',
        };

        const events: Event[] = [];

        await runWorkflow(
          'function workflow() { throw new Error("test"); }',
          workflowRun,
          events
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('Error');
      expect(error.message).toEqual('test');
    });

    it('should throw `StepNotRunError` when a step does not have an event result entry', async () => {
      let error: Error | undefined;
      try {
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: [],
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          updated_at: new Date('2024-01-01T00:00:00.000Z'),
          started_at: new Date('2024-01-01T00:00:00.000Z'),
          owner_id: 'test-owner',
          project_id: 'test-project',
          environment: 'test',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'StepNotRunError' because it has not been run yet
            const a = await add(1, 2);
            return a;
          }`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('StepNotRunError');
      expect(error.message).toEqual(
        'Step add has not been run yet. Arguments: [1,2]'
      );
    });

    it('`StepNotRunError` should not be catchable by user code', async () => {
      let error: Error | undefined;
      try {
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: [],
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          updated_at: new Date('2024-01-01T00:00:00.000Z'),
          started_at: new Date('2024-01-01T00:00:00.000Z'),
          owner_id: 'test-owner',
          project_id: 'test-project',
          environment: 'test',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            try {
              // 'add()' will throw a 'StepNotRunError' because it has not been run yet
              const a = await add(1, 2);
              return a;
            } catch (err) {
              return err;
            }
          }`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('StepNotRunError');
      expect(error.message).toEqual(
        'Step add has not been run yet. Arguments: [1,2]'
      );
    });
  });
});
