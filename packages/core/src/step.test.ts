import { createRandomUUID } from '@vercel/workflow-vm/dist/uuid.js';
import seedrandom from 'seedrandom';
import { describe, expect, it, vi } from 'vitest';
import { EventsConsumer } from './events-consumer.js';
import { FatalError, StepsNotRunError } from './global.js';
import { createUseStep, type WorkflowContext } from './step.js';

describe('createUseStep', () => {
  it('should resolve with the result of a step', async () => {
    const ctx: WorkflowContext = {
      eventsConsumer: new EventsConsumer([
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'step_result',
          event_data: {
            result: 3,
            invocation_id: 'd6f45471-b67f-4f0c-b60b-9ac709c285e1',
          },
          sequence_number: 0,
          created_at: new Date(),
        },
      ]),
      invocationsQueue: [],
      onWorkflowError: vi.fn(),
      randomUUID: createRandomUUID(seedrandom('test')),
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    const result = await add(1, 2);
    expect(result).toBe(3);
    expect(ctx.onWorkflowError).not.toHaveBeenCalled();
  });

  it('should reject with a fatal error if the step fails', async () => {
    const ctx: WorkflowContext = {
      eventsConsumer: new EventsConsumer([
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'step_failed',
          event_data: {
            error: 'test',
            fatal: true,
            invocation_id: 'a6318e4e-853a-4b24-bc43-dd5b5863aabe',
          },
          sequence_number: 0,
          created_at: new Date(),
        },
      ]),
      invocationsQueue: [],
      onWorkflowError: vi.fn(),
      randomUUID: createRandomUUID(seedrandom('test2')),
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    let error: Error | undefined;
    try {
      await add(1, 2);
    } catch (err_) {
      error = err_ as Error;
    }
    expect(error).toBeInstanceOf(FatalError);
    expect((error as FatalError).message).toBe('test');
    expect((error as FatalError).fatal).toBe(true);
    expect(ctx.onWorkflowError).not.toHaveBeenCalled();
  });

  it('should invoke workflow error handler if step is not run (single)', async () => {
    let workflowErrorReject: (err: Error) => void;
    const workflowErrorPromise = new Promise<Error>((_, reject) => {
      workflowErrorReject = reject;
    });

    const ctx: WorkflowContext = {
      eventsConsumer: new EventsConsumer([]),
      invocationsQueue: [],
      onWorkflowError(err) {
        workflowErrorReject(err);
      },
      randomUUID: createRandomUUID(seedrandom('test3')),
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    let error: Error | undefined;
    try {
      await Promise.race([add(1, 2), workflowErrorPromise]);
    } catch (err_) {
      error = err_ as Error;
    }
    expect(error).toBeInstanceOf(StepsNotRunError);
    expect((error as StepsNotRunError).message).toBe(
      '1 steps have not been run yet'
    );
    expect(ctx.invocationsQueue).toEqual((error as StepsNotRunError).steps);
    expect((error as StepsNotRunError).steps).toEqual([
      {
        stepName: 'add',
        args: [1, 2],
        invocationId: '013d5317-4831-44a0-b48d-68fd283cbe80',
      },
    ]);
  });

  it('should invoke workflow error handler if step is not run (concurrent)', async () => {
    let workflowErrorReject: (err: Error) => void;
    const workflowErrorPromise = new Promise<Error>((_, reject) => {
      workflowErrorReject = reject;
    });

    const ctx: WorkflowContext = {
      eventsConsumer: new EventsConsumer([]),
      invocationsQueue: [],
      onWorkflowError(err) {
        workflowErrorReject(err);
      },
      randomUUID: createRandomUUID(seedrandom('test4')),
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    let error: Error | undefined;
    try {
      await Promise.race([
        add(1, 2),
        add(3, 4),
        add(5, 6),
        workflowErrorPromise,
      ]);
    } catch (err_) {
      error = err_ as Error;
    }
    expect(error).toBeInstanceOf(StepsNotRunError);
    expect((error as StepsNotRunError).message).toBe(
      '3 steps have not been run yet'
    );
    expect(ctx.invocationsQueue).toEqual((error as StepsNotRunError).steps);
    expect((error as StepsNotRunError).steps).toEqual([
      {
        stepName: 'add',
        args: [1, 2],
        invocationId: '79d54d5f-4f7c-4c39-b1d0-aeaa220cadd2',
      },
      {
        stepName: 'add',
        args: [3, 4],
        invocationId: '817f8259-d23c-4462-b0a9-350eaf26e55e',
      },
      {
        stepName: 'add',
        args: [5, 6],
        invocationId: 'f611f97e-0436-44bd-b41b-e812e6a7cd30',
      },
    ]);
  });
});
