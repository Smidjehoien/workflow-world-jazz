import { types } from 'node:util';
import { assert, describe, expect, it } from 'vitest';
import type { Event, WorkflowRun } from './backend.js';
import type { StepsNotRunError } from './global.js';
import {
  dehydrateStepReturnValue,
  dehydrateWorkflowArguments,
  hydrateWorkflowReturnValue,
} from './serialization.js';
import { runWorkflow } from './workflow.js';

describe('runWorkflow', () => {
  describe('successful workflow execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const ops: Promise<any>[] = [];
      const workflowCode = 'function workflow() { return "success"; }';

      const workflowRun: WorkflowRun = {
        id: 'test-run-123',
        workflow_name: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      const result = await runWorkflow(workflowCode, workflowRun, events);
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual('success');
    });

    it('should execute workflow with arguments', async () => {
      const ops: Promise<any>[] = [];
      const workflowCode = 'function workflow(a, b) { return a + b; }';

      const workflowRun: WorkflowRun = {
        id: 'test-run-123',
        workflow_name: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([1, 2], ops),
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      const result = await runWorkflow(workflowCode, workflowRun, events);
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(3);
    });

    it('allow user code to handle user-defined errors', async () => {
      const ops: Promise<any>[] = [];
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
        input: dehydrateWorkflowArguments([], ops),
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      const result = hydrateWorkflowReturnValue(
        (await runWorkflow(workflowCode, workflowRun, events)) as any,
        ops
      );
      assert(types.isNativeError(result));
      expect(result.name).toEqual('TypeError');
      expect(result.message).toEqual('my workflow error');
    });
  });

  it('should resolve a step that has a `step_result` event', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'test-run-123';
    const workflowRun: WorkflowRun = {
      id: workflowRunId,
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 1,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'StepsNotRunError' because it has not been run yet
            const a = await add(1, 2);
            return a;
          }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(3);
  });

  it('should update the timestamp in the vm context as events are replayed', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'test-run-123';
    const workflowRun: WorkflowRun = {
      id: workflowRunId,
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 0,
        created_at: new Date('2024-01-01T00:00:01.000Z'),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 1,
        created_at: new Date('2024-01-01T00:00:02.000Z'),
      },
      {
        id: 'event-2',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 2,
        created_at: new Date('2024-01-01T00:00:03.000Z'),
      },
      {
        id: 'event-3',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 3,
        created_at: new Date('2024-01-01T00:00:04.000Z'),
      },
      {
        id: 'event-4',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: 'ab4359f5-1521-4d72-b5e9-13e841129b90',
        },
        sequence_number: 4,
        created_at: new Date('2024-01-01T00:00:05.000Z'),
      },
      {
        id: 'event-5',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: 'ab4359f5-1521-4d72-b5e9-13e841129b90',
        },
        sequence_number: 5,
        created_at: new Date('2024-01-01T00:00:06.000Z'),
      },
    ];

    const result = await runWorkflow(
      `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const timestamps = [];
            timestamps.push(new Date());
            await add(1, 2);
            timestamps.push(Date.now());
            await add(3, 4);
            timestamps.push(Date.now());
            await add(5, 6);
            timestamps.push(new Date());
            return timestamps;
          }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([
      new Date('2024-01-01T00:00:00.000Z'),
      1704067203000,
      1704067205000,
      new Date('2024-01-01T00:00:06.000Z'),
    ]);
  });

  it('should resolve `Promise.all()` steps that have `step_result` events', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'test-run-123';
    const workflowRun: WorkflowRun = {
      id: workflowRunId,
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 1,
        created_at: new Date(),
      },
      {
        id: 'event-2',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 2,
        created_at: new Date(),
      },
      {
        id: 'event-3',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(7, ops),
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 3,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.all([add(1, 2), add(3, 4)]);
            return a;
          }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([3, 7]);
  });

  it('should resolve `Promise.race()` steps that have `step_result` events (first promise resolves first)', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'test-run-123';
    const workflowRun: WorkflowRun = {
      id: workflowRunId,
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 1,
        created_at: new Date(),
      },
      {
        id: 'event-2',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 2,
        created_at: new Date(),
      },
      {
        id: 'event-3',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(7, ops),
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 3,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.race([add(1, 2), add(3, 4)]);
            return a;
          }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(3);
  });

  it('should resolve `Promise.race()` steps that have `step_result` events (second promise resolves first)', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'test-run-123';
    const workflowRun: WorkflowRun = {
      id: workflowRunId,
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRunId,
        event_type: 'step_started',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 1,
        created_at: new Date(),
      },
      {
        id: 'event-2',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(7, ops),
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 2,
        created_at: new Date(),
      },
      {
        id: 'event-3',
        workflow_run_id: workflowRunId,
        event_type: 'step_result',
        event_data: {
          result: dehydrateStepReturnValue(3, ops),
          invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
        },
        sequence_number: 3,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.race([add(1, 2), add(3, 4)]);
            return a;
          }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(7);
  });

  describe('error handling', () => {
    it('should throw ReferenceError when workflow code does not return a function', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'value',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
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
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
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

    it('should throw `StepsNotRunError` when a step does not have an event result entry', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
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
            // 'add()' will throw a 'StepsNotRunError' because it has not been run yet
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
      expect(error.name).toEqual('StepsNotRunError');
      expect(error.message).toEqual('1 steps have not been run yet');
      expect((error as StepsNotRunError).steps).toEqual([
        {
          type: 'step',
          stepName: 'add',
          invocationId: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          args: [1, 2],
        },
      ]);
    });

    it('should throw `StepsNotRunError` when a step has only a "step_started" event', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          updated_at: new Date('2024-01-01T00:00:00.000Z'),
          started_at: new Date('2024-01-01T00:00:00.000Z'),
          owner_id: 'test-owner',
          project_id: 'test-project',
          environment: 'test',
        };

        const events: Event[] = [
          {
            id: 'event-0',
            workflow_run_id: workflowRun.id,
            event_type: 'step_started',
            event_data: {
              invocation_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
            },
            sequence_number: 0,
            created_at: new Date(),
          },
        ];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'StepsNotRunError' because it has not been run yet
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
      expect(error.name).toEqual('StepsNotRunError');
      expect(error.message).toEqual('0 steps have not been run yet');
      expect((error as StepsNotRunError).steps).toEqual([]);
    });

    it('should throw `StepsNotRunError` for multiple steps with `Promise.all()`', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
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
            const a = await Promise.all([add(1, 2), add(3, 4)]);
            return a;
          }`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('StepsNotRunError');
      expect(error.message).toEqual('2 steps have not been run yet');
      expect((error as StepsNotRunError).steps).toEqual([
        {
          type: 'step',
          stepName: 'add',
          invocationId: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          args: [1, 2],
        },
        {
          type: 'step',
          stepName: 'add',
          invocationId: '84459663-47c5-4dd4-b3cc-08d267df2c13',
          args: [3, 4],
        },
      ]);
    });

    it('`StepsNotRunError` should not be catchable by user code', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          id: 'test-run-123',
          workflow_name: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
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
              // 'add()' will throw a 'StepsNotRunError' because it has not been run yet
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
      expect(error.name).toEqual('StepsNotRunError');
      expect(error.message).toEqual('1 steps have not been run yet');
    });
  });

  it('should throw `StepsNotRunError` when a webhook is awaiting without a "webhook_request" event', async () => {
    let error: Error | undefined;
    try {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        id: 'test-run-123',
        workflow_name: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: new Date('2024-01-01T00:00:00.000Z'),
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        owner_id: 'test-owner',
        project_id: 'test-project',
        environment: 'test',
      };

      const events: Event[] = [];

      await runWorkflow(
        `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
          async function workflow() {
            const webhook = useWebhook();
            const req = await webhook;
            return req.url;
          }`,
        workflowRun,
        events
      );
    } catch (err) {
      error = err;
    }
    assert(error);
    expect(error.name).toEqual('StepsNotRunError');
    expect(error.message).toEqual('1 webhooks have not been created yet');
    expect((error as StepsNotRunError).steps).toHaveLength(1);
    expect((error as StepsNotRunError).steps[0].type).toEqual('webhook');
  });

  it('should resolve `useWebhook` await upon "webhook_request" event', async () => {
    const ops: Promise<any>[] = [];
    const workflowRun: WorkflowRun = {
      id: 'test-run-123',
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com'),
            ops
          ),
        },
        sequence_number: 0,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
      async function workflow() {
        const webhook = useWebhook();
        const req = await webhook;
        return req.url;
      }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(
      'https://example.com/'
    );
  });

  it('should resolve multiple `useWebhook` awaits upon "webhook_request" events', async () => {
    const ops: Promise<any>[] = [];
    const workflowRun: WorkflowRun = {
      id: 'test-run-123',
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com'),
            ops
          ),
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com/2'),
            ops
          ),
        },
        sequence_number: 1,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
      async function workflow() {
        const webhook = useWebhook();
        const req1 = await webhook;
        const req2 = await webhook;
        return [req1.url, req2.url];
      }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([
      'https://example.com/',
      'https://example.com/2',
    ]);
  });

  it('should support `for await` loops with `useWebhook`', async () => {
    const ops: Promise<any>[] = [];
    const workflowRun: WorkflowRun = {
      id: 'test-run-123',
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com'),
            ops
          ),
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com/2', {
              method: 'POST',
            }),
            ops
          ),
        },
        sequence_number: 1,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
      async function workflow() {
        const webhook = useWebhook();
        const reqs = [];
        for await (const req of webhook) {
          reqs.push({ url: req.url, method: req.method });
          if (reqs.length === 2) {
            break;
          }
        }
        return reqs;
      }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([
      { url: 'https://example.com/', method: 'GET' },
      { url: 'https://example.com/2', method: 'POST' },
    ]);
  });

  it('should support multiple "webhook_request" events even when the workflow is only interested in one', async () => {
    const ops: Promise<any>[] = [];
    const workflowRun: WorkflowRun = {
      id: 'test-run-123',
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com'),
            ops
          ),
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com/2', {
              method: 'POST',
            }),
            ops
          ),
        },
        sequence_number: 1,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
      async function workflow() {
        const webhook = useWebhook();
        const req = await webhook;
        return { url: req.url, method: req.method };
      }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual({
      url: 'https://example.com/',
      method: 'GET',
    });
  });

  it('should support multiple queued "webhook_request" events with step events in between', async () => {
    const ops: Promise<any>[] = [];
    const workflowRun: WorkflowRun = {
      id: 'test-run-123',
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com'),
            ops
          ),
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com/2', {
              method: 'POST',
            }),
            ops
          ),
        },
        sequence_number: 1,
        created_at: new Date(),
      },
      {
        id: 'event-2',
        workflow_run_id: workflowRun.id,
        event_type: 'step_started',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 2,
        created_at: new Date(),
      },
      {
        id: 'event-3',
        workflow_run_id: workflowRun.id,
        event_type: 'step_result',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
          result: dehydrateStepReturnValue(3, ops),
        },
        sequence_number: 3,
        created_at: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
      const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
      async function workflow() {
        const webhook = useWebhook();
        const req1 = await webhook;
        const a = await add(1, 2);
        const req2 = await webhook;
        return {
          url: req1.url,
          method: req1.method,
          a,
          url2: req2.url,
          method2: req2.method,
        };
      }`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual({
      url: 'https://example.com/',
      method: 'GET',
      a: 3,
      url2: 'https://example.com/2',
      method2: 'POST',
    });
  });

  it('should throw `StepsNotRunError` when a webhook is awaited after the event log is empty', async () => {
    const ops: Promise<any>[] = [];
    const workflowRun: WorkflowRun = {
      id: 'test-run-123',
      workflow_name: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_id: 'test-owner',
      project_id: 'test-project',
      environment: 'test',
    };

    const events: Event[] = [
      {
        id: 'event-0',
        workflow_run_id: workflowRun.id,
        event_type: 'webhook_request',
        event_data: {
          webhook_id: 'e93eb481-2e7f-43dc-9ab7-475ed32659f6',
          request: dehydrateStepReturnValue(
            new Request('https://example.com'),
            ops
          ),
        },
        sequence_number: 0,
        created_at: new Date(),
      },
      {
        id: 'event-1',
        workflow_run_id: workflowRun.id,
        event_type: 'step_started',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
        },
        sequence_number: 1,
        created_at: new Date(),
      },
      {
        id: 'event-2',
        workflow_run_id: workflowRun.id,
        event_type: 'step_result',
        event_data: {
          invocation_id: '84459663-47c5-4dd4-b3cc-08d267df2c13',
          result: dehydrateStepReturnValue(3, ops),
        },
        sequence_number: 2,
        created_at: new Date(),
      },
    ];

    let error: Error | undefined;
    try {
      await runWorkflow(
        `const useWebhook = globalThis[Symbol.for("WORKFLOW_USE_WEBHOOK")];
      const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
      async function workflow() {
        const webhook = useWebhook();
        for await (const req of webhook) {
          await add(1, 2);
        }
      }`,
        workflowRun,
        events
      );
    } catch (err) {
      error = err;
    }
    assert(error);
    expect(error.name).toEqual('StepsNotRunError');
    expect(error.message).toEqual('1 webhooks have not been created yet');
    expect((error as StepsNotRunError).steps).toHaveLength(1);
    expect((error as StepsNotRunError).steps[0].type).toEqual('webhook');
  });
});
