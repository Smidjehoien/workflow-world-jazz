import { types } from 'node:util';
import type { Event, WorkflowRun } from '@vercel/workflow-world';
import { assert, describe, expect, it } from 'vitest';
import type { WorkflowSuspension } from './global.js';
import {
  dehydrateStepReturnValue,
  dehydrateWorkflowArguments,
  hydrateWorkflowReturnValue,
} from './serialization.js';
import { runWorkflow } from './workflow.js';

describe('runWorkflow', () => {
  const getWorkflowTransformCode = (workflowName?: string) =>
    `;globalThis.__private_workflows = new Map();
    ${
      workflowName
        ? `
      globalThis.__private_workflows.set(${JSON.stringify(workflowName)}, ${workflowName})
    `
        : ''
    }
    `;

  describe('successful workflow execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const ops: Promise<any>[] = [];
      const workflowCode = `function workflow() { return "success"; }${getWorkflowTransformCode('workflow')}`;

      const workflowRun: WorkflowRun = {
        runId: 'wrun_123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [];

      const result = await runWorkflow(workflowCode, workflowRun, events);
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual('success');
    });

    it('should execute workflow with arguments', async () => {
      const ops: Promise<any>[] = [];
      const workflowCode = `function workflow(a, b) { return a + b; }${getWorkflowTransformCode('workflow')}`;

      const workflowRun: WorkflowRun = {
        runId: 'wrun_123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([1, 2], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
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
      }${getWorkflowTransformCode('workflow')}`;

      const workflowRun: WorkflowRun = {
        runId: 'wrun_123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
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

  it('should resolve a step that has a `step_completed` event', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'wrun_123';
    const workflowRun: WorkflowRun = {
      runId: workflowRunId,
      workflowName: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      deploymentId: 'test-deployment',
    };

    const events: Event[] = [
      {
        eventId: 'event-0',
        runId: workflowRunId,
        eventType: 'step_started',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HF',
        createdAt: new Date(),
      },
      {
        eventId: 'event-1',
        runId: workflowRunId,
        eventType: 'step_completed',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HF',
        eventData: {
          result: dehydrateStepReturnValue(3, ops),
        },
        createdAt: new Date(),
      },
    ];

    const result = await runWorkflow(
      `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'WorkflowSuspension' because it has not been run yet
            const a = await add(1, 2);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
      workflowRun,
      events
    );
    expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(3);
  });

  it('should update the timestamp in the vm context as events are replayed', async () => {
    const ops: Promise<any>[] = [];
    const workflowRunId = 'wrun_123';
    const workflowRun: WorkflowRun = {
      runId: workflowRunId,
      workflowName: 'workflow',
      status: 'running',
      input: dehydrateWorkflowArguments([], ops),
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      deploymentId: 'test-deployment',
    };

    const events: Event[] = [
      {
        eventId: 'event-0',
        runId: workflowRunId,
        eventType: 'step_started',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HF',
        createdAt: new Date('2024-01-01T00:00:01.000Z'),
      },
      {
        eventId: 'event-1',
        runId: workflowRunId,
        eventType: 'step_completed',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HF',
        eventData: {
          result: dehydrateStepReturnValue(3, ops),
        },
        createdAt: new Date('2024-01-01T00:00:02.000Z'),
      },
      {
        eventId: 'event-2',
        runId: workflowRunId,
        eventType: 'step_started',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HG',
        createdAt: new Date('2024-01-01T00:00:03.000Z'),
      },
      {
        eventId: 'event-3',
        runId: workflowRunId,
        eventType: 'step_completed',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HG',
        eventData: {
          result: dehydrateStepReturnValue(3, ops),
        },
        createdAt: new Date('2024-01-01T00:00:04.000Z'),
      },
      {
        eventId: 'event-4',
        runId: workflowRunId,
        eventType: 'step_started',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HH',
        createdAt: new Date('2024-01-01T00:00:05.000Z'),
      },
      {
        eventId: 'event-5',
        runId: workflowRunId,
        eventType: 'step_completed',
        correlationId: 'step_01HK153X00Y11PCQTCHQRK34HH',
        eventData: {
          result: dehydrateStepReturnValue(3, ops),
        },
        createdAt: new Date('2024-01-01T00:00:06.000Z'),
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
          }${getWorkflowTransformCode('workflow')}`,
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

  // TODO: Date.now determinism is currently broken in the workflow!!
  it.fails(
    'should maintain determinism of `Date` across executions',
    async () => {
      const ops: Promise<any>[] = [];
      const workflowRunId = 'test-run-123';
      const workflowRun: WorkflowRun = {
        runId: workflowRunId,
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          createdAt: new Date('2024-01-01T00:00:01.000Z'),
        },
        {
          eventId: 'event-1',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          createdAt: new Date('2024-01-01T00:00:01.000Z'),
        },
        {
          eventId: 'event-2',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            result: dehydrateStepReturnValue(undefined, ops),
          },
          createdAt: new Date('2024-01-01T00:00:03.000Z'),
        },
      ];

      const workflowCode = `
      const sleep = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("sleep");
      async function workflow() {
        await Promise.race([sleep(1), sleep(2)]);
        return Date.now();
      }${getWorkflowTransformCode('workflow')}`;

      // Execute the workflow with only sleep(1) resolved
      const result1 = await runWorkflow(workflowCode, workflowRun, events);

      // Execute again with both sleeps resolved this time
      const result2 = await runWorkflow(workflowCode, workflowRun, [
        ...events,
        {
          eventId: 'event-3',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          eventData: {
            result: dehydrateStepReturnValue(undefined, ops),
          },
          createdAt: new Date('2024-01-01T00:00:04.000Z'),
        },
      ]);

      // The date should be the same
      const date1 = hydrateWorkflowReturnValue(result1 as any, ops);
      const date2 = hydrateWorkflowReturnValue(result2 as any, ops);
      expect(date1).toEqual(date2);
    }
  );

  describe('concurrency', () => {
    it('should resolve `Promise.all()` steps that have `step_completed` events', async () => {
      const ops: Promise<any>[] = [];
      const workflowRunId = 'test-run-123';
      const workflowRun: WorkflowRun = {
        runId: workflowRunId,
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          createdAt: new Date(),
        },
        {
          eventId: 'event-1',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          createdAt: new Date(),
        },
        {
          eventId: 'event-2',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            result: dehydrateStepReturnValue(3, ops),
          },
          createdAt: new Date(),
        },
        {
          eventId: 'event-3',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          eventData: {
            result: dehydrateStepReturnValue(7, ops),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.all([add(1, 2), add(3, 4)]);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([3, 7]);
    });

    it('should resolve `Promise.race()` steps that have `step_completed` events (first promise resolves first)', async () => {
      const ops: Promise<any>[] = [];
      const workflowRunId = 'test-run-123';
      const workflowRun: WorkflowRun = {
        runId: workflowRunId,
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          createdAt: new Date(),
        },
        {
          eventId: 'event-1',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          createdAt: new Date(),
        },
        {
          eventId: 'event-2',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            result: dehydrateStepReturnValue(3, ops),
          },
          createdAt: new Date(),
        },
        {
          eventId: 'event-3',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          eventData: {
            result: dehydrateStepReturnValue(7, ops),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.race([add(1, 2), add(3, 4)]);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(3);
    });

    it('should resolve `Promise.race()` steps that have `step_completed` events (second promise resolves first)', async () => {
      const ops: Promise<any>[] = [];
      const workflowRunId = 'test-run-123';
      const workflowRun: WorkflowRun = {
        runId: workflowRunId,
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          createdAt: new Date(),
        },
        {
          eventId: 'event-1',
          runId: workflowRunId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          createdAt: new Date(),
        },
        {
          eventId: 'event-2',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          eventData: {
            result: dehydrateStepReturnValue(7, ops),
          },
          createdAt: new Date(),
        },
        {
          eventId: 'event-3',
          runId: workflowRunId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            result: dehydrateStepReturnValue(3, ops),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.race([add(1, 2), add(3, 4)]);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(7);
    });

    it('should handle Promise.race with multiple concurrent steps completing out of order', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'wrun_01K75533W56DAE35VY3082DN3P',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventType: 'step_started',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGD',
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K755385N02MMWXYHFCQSP9P0',
          createdAt: new Date('2025-10-09T18:52:51.253Z'),
        },
        {
          eventType: 'step_started',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGE',
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K755386GHGAFYYDC58V17E3T',
          createdAt: new Date('2025-10-09T18:52:51.280Z'),
        },
        {
          eventType: 'step_started',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGF',
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K75538D4Q4X8PJ1ZNDZD5R0W',
          createdAt: new Date('2025-10-09T18:52:51.492Z'),
        },
        {
          eventType: 'step_started',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGG',
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K75538Y9GEHXJQXT3JB89M4C',
          createdAt: new Date('2025-10-09T18:52:52.041Z'),
        },
        {
          eventType: 'step_started',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGH',
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K75539CD2PAH419SKJ2X5V5T',
          createdAt: new Date('2025-10-09T18:52:52.493Z'),
        },
        {
          eventType: 'step_completed',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGH',
          eventData: {
            result: dehydrateStepReturnValue(4, ops),
          },
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K7553EABWCK00JQ9R8P1FTK7',
          createdAt: new Date('2025-10-09T18:52:57.547Z'),
        },
        {
          eventType: 'step_completed',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGG',
          eventData: {
            result: dehydrateStepReturnValue(3, ops),
          },
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K7553F31YS6C94NG23WGEEMV',
          createdAt: new Date('2025-10-09T18:52:58.337Z'),
        },
        {
          eventType: 'step_completed',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGF',
          eventData: {
            result: dehydrateStepReturnValue(2, ops),
          },
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K7553G0XEE4R440QS5SV89YE',
          createdAt: new Date('2025-10-09T18:52:59.293Z'),
        },
        {
          eventType: 'step_completed',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGE',
          eventData: {
            result: dehydrateStepReturnValue(1, ops),
          },
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K7553HS9R1XJQKVVW0ZRCMNP',
          createdAt: new Date('2025-10-09T18:53:01.097Z'),
        },
        {
          eventType: 'step_completed',
          correlationId: 'step_01HK153X00DKMJB5AQEJZ3FQGD',
          eventData: {
            result: dehydrateStepReturnValue(0, ops),
          },
          runId: 'wrun_01K75533W56DAE35VY3082DN3P',
          eventId: 'evnt_01K7553K67FQG02YCFE9QDKJ90',
          createdAt: new Date('2025-10-09T18:53:02.535Z'),
        },
      ];

      const result = await runWorkflow(
        `
        const promiseRaceStressTestDelayStep = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("promiseRaceStressTestDelayStep");

        async function workflow() {
  const promises = new Map();
  const done = [];
  for (let i = 0; i < 5; i++) {
    const dur = 1000 * (10 - i);
    promises.set(i, promiseRaceStressTestDelayStep(dur, i));
  }

  while (promises.size > 0) {
    const res = await Promise.race(promises.values());
    done.push(res);
    promises.delete(res);
  }
    return done;
}${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([
        4, 3, 2, 1, 0,
      ]);
    });
  });

  describe('error handling', () => {
    it('should throw ReferenceError when workflow code does not return a function', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'value',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const value = "test"${getWorkflowTransformCode()}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('ReferenceError');
      expect(error.message).toEqual(
        'Workflow "value" must be a function, but got "undefined" instead'
      );
    });

    it('should throw user-defined error when workflow code throws an error', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [];

        await runWorkflow(
          `function workflow() { throw new Error("test"); }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('Error');
      expect(error.message).toEqual('test');
    });

    it('should throw `WorkflowSuspension` when a step does not have an event result entry', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'WorkflowSuspension' because it has not been run yet
            const a = await add(1, 2);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('WorkflowSuspension');
      expect(error.message).toEqual('1 step has not been run yet');
      expect((error as WorkflowSuspension).steps).toEqual([
        {
          type: 'step',
          stepName: 'add',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          args: [1, 2],
        },
      ]);
    });

    it('should throw `WorkflowSuspension` when a step has only a "step_started" event', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [
          {
            eventId: 'event-0',
            runId: workflowRun.runId,
            eventType: 'step_started',
            correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
            createdAt: new Date(),
          },
        ];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'WorkflowSuspension' because it has not been run yet
            const a = await add(1, 2);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('WorkflowSuspension');
      expect(error.message).toEqual('0 steps have not been run yet');
      expect((error as WorkflowSuspension).steps).toEqual([]);
    });

    it('should throw `WorkflowSuspension` for multiple steps with `Promise.all()`', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            const a = await Promise.all([add(1, 2), add(3, 4)]);
            return a;
          }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('WorkflowSuspension');
      expect(error.message).toEqual('2 steps have not been run yet');
      expect((error as WorkflowSuspension).steps).toEqual([
        {
          type: 'step',
          stepName: 'add',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JX',
          args: [1, 2],
        },
        {
          type: 'step',
          stepName: 'add',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          args: [3, 4],
        },
      ]);
    });

    it('`WorkflowSuspension` should not be catchable by user code', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            try {
              // 'add()' will throw a 'WorkflowSuspension' because it has not been run yet
              const a = await add(1, 2);
              return a;
            } catch (err) {
              return err;
            }
          }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('WorkflowSuspension');
      expect(error.message).toEqual('1 step has not been run yet');
    });
  });

  describe('hook', () => {
    it('should throw `WorkflowSuspension` when a hook is awaiting without a "hook_received" event', async () => {
      let error: Error | undefined;
      try {
        const ops: Promise<any>[] = [];
        const workflowRun: WorkflowRun = {
          runId: 'test-run-123',
          workflowName: 'workflow',
          status: 'running',
          input: dehydrateWorkflowArguments([], ops),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          deploymentId: 'test-deployment',
        };

        const events: Event[] = [];

        await runWorkflow(
          `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
          async function workflow() {
            const hook = createHook();
            const payload = await hook;
            return payload.message;
          }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('WorkflowSuspension');
      expect(error.message).toEqual('1 hook has not been created yet');
      expect((error as WorkflowSuspension).steps).toHaveLength(1);
      expect((error as WorkflowSuspension).steps[0].type).toEqual('hook');
    });

    it('should resolve `createHook` await upon "hook_received" event', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue(
              { message: 'Hello from hook' },
              ops
            ),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      async function workflow() {
        const hook = createHook();
        const payload = await hook;
        return payload.message;
      }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(
        'Hello from hook'
      );
    });

    it('should resolve multiple `createHook` awaits upon "hook_received" events', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue(
              { message: 'First payload' },
              ops
            ),
          },
          createdAt: new Date(),
        },
        {
          eventId: 'event-1',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue(
              { message: 'Second payload' },
              ops
            ),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      async function workflow() {
        const hook = createHook();
        const payload1 = await hook;
        const payload2 = await hook;
        return [payload1.message, payload2.message];
      }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([
        'First payload',
        'Second payload',
      ]);
    });

    it('should support `for await` loops with `createHook`', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue(
              { count: 1, status: 'active' },
              ops
            ),
          },
          createdAt: new Date(),
        },
        {
          eventId: 'event-1',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue(
              { count: 2, status: 'complete' },
              ops
            ),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      async function workflow() {
        const hook = createHook();
        const payloads = [];
        for await (const payload of hook) {
          payloads.push({ count: payload.count, status: payload.status });
          if (payloads.length === 2) {
            break;
          }
        }
        return payloads;
      }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual([
        { count: 1, status: 'active' },
        { count: 2, status: 'complete' },
      ]);
    });

    it('should support multiple "hook_received" events even when the workflow is only interested in one', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue({ value: 100 }, ops),
          },
          createdAt: new Date(),
        },
        {
          eventId: 'event-1',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue({ value: 200 }, ops),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      async function workflow() {
        const hook = createHook();
        const payload = await hook;
        return payload.value;
      }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual(100);
    });

    it('should support multiple queued "hook_received" events with step events in between', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue({ data: 'first' }, ops),
          },
          createdAt: new Date('2024-01-01T00:00:01.000Z'),
        },
        {
          eventId: 'event-1',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue({ data: 'second' }, ops),
          },
          createdAt: new Date('2024-01-01T00:00:02.000Z'),
        },
        {
          eventId: 'event-2',
          runId: workflowRun.runId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          createdAt: new Date('2024-01-01T00:00:03.000Z'),
        },
        {
          eventId: 'event-3',
          runId: workflowRun.runId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          eventData: {
            result: dehydrateStepReturnValue(42, ops),
          },
          createdAt: new Date('2024-01-01T00:00:04.000Z'),
        },
      ];

      const result = await runWorkflow(
        `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
      async function workflow() {
        const hook = createHook();
        const payload1 = await hook;
        const stepResult = await add(1, 2);
        const payload2 = await hook;
        return {
          data1: payload1.data,
          stepResult,
          data2: payload2.data,
        };
      }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual({
        data1: 'first',
        stepResult: 42,
        data2: 'second',
      });
    });

    it('should throw `WorkflowSuspension` when a hook is awaited after the event log is empty', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue({ iteration: 1 }, ops),
          },
          createdAt: new Date('2024-01-01T00:00:01.000Z'),
        },
        {
          eventId: 'event-1',
          runId: workflowRun.runId,
          eventType: 'step_started',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          createdAt: new Date('2024-01-01T00:00:02.000Z'),
        },
        {
          eventId: 'event-2',
          runId: workflowRun.runId,
          eventType: 'step_completed',
          correlationId: 'step_01HK153X008RT6YEW43G8QX6JY',
          eventData: {
            result: dehydrateStepReturnValue(10, ops),
          },
          createdAt: new Date('2024-01-01T00:00:03.000Z'),
        },
      ];

      let error: Error | undefined;
      try {
        await runWorkflow(
          `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
      async function workflow() {
        const hook = createHook();
        for await (const payload of hook) {
          await add(payload.iteration, 2);
        }
      }${getWorkflowTransformCode('workflow')}`,
          workflowRun,
          events
        );
      } catch (err) {
        error = err as Error;
      }
      assert(error);
      expect(error.name).toEqual('WorkflowSuspension');
      expect(error.message).toEqual('1 hook has not been created yet');
      expect((error as WorkflowSuspension).steps).toHaveLength(1);
      expect((error as WorkflowSuspension).steps[0].type).toEqual('hook');
    });

    it('should handle hook with custom token', async () => {
      const ops: Promise<any>[] = [];
      const workflowRun: WorkflowRun = {
        runId: 'test-run-123',
        workflowName: 'workflow',
        status: 'running',
        input: dehydrateWorkflowArguments([], ops),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        deploymentId: 'test-deployment',
      };

      const events: Event[] = [
        {
          eventId: 'event-0',
          runId: workflowRun.runId,
          eventType: 'hook_received',
          correlationId: 'hook_01HK153X008RT6YEW43G8QX6JX',
          eventData: {
            payload: dehydrateStepReturnValue({ result: 'success' }, ops),
          },
          createdAt: new Date(),
        },
      ];

      const result = await runWorkflow(
        `const createHook = globalThis[Symbol.for("WORKFLOW_CREATE_HOOK")];
      async function workflow() {
        const hook = createHook({ token: 'my-custom-token' });
        const payload = await hook;
        return { token: hook.token, result: payload.result };
      }${getWorkflowTransformCode('workflow')}`,
        workflowRun,
        events
      );
      expect(hydrateWorkflowReturnValue(result as any, ops)).toEqual({
        token: 'my-custom-token',
        result: 'success',
      });
    });
  });
});
