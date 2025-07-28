import { createContext } from '@vercel/workflow-vm';
import { describe, expect, it, vi } from 'vitest';
import { EventsConsumer } from './events-consumer.js';
import { FatalError, StepsNotRunError } from './global.js';
import { createUseStep, type WorkflowOrchestratorContext } from './step.js';

describe('createUseStep', () => {
  it('should resolve with the result of a step', async () => {
    const context = createContext({
      seed: 'test',
      fixedTimestamp: 1753481739458,
    });
    const ctx: WorkflowOrchestratorContext = {
      globalThis: context.globalThis,
      eventsConsumer: new EventsConsumer([
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'step_result',
          event_data: {
            result: [3],
            invocation_id: 'd6f45471-b67f-4f0c-b60b-9ac709c285e1',
          },
          sequence_number: 0,
          created_at: new Date(),
        },
      ]),
      invocationsQueue: [],
      onWorkflowError: vi.fn(),
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    const result = await add(1, 2);
    expect(result).toBe(3);
    expect(ctx.onWorkflowError).not.toHaveBeenCalled();
  });

  it('should reject with a fatal error if the step fails', async () => {
    const context = createContext({
      seed: 'test',
      fixedTimestamp: 1753481739458,
    });
    const ctx: WorkflowOrchestratorContext = {
      eventsConsumer: new EventsConsumer([
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'step_failed',
          event_data: {
            error: 'test',
            fatal: true,
            invocation_id: 'd6f45471-b67f-4f0c-b60b-9ac709c285e1',
          },
          sequence_number: 0,
          created_at: new Date(),
        },
      ]),
      invocationsQueue: [],
      onWorkflowError: vi.fn(),
      globalThis: context.globalThis,
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

    const context = createContext({
      seed: 'test',
      fixedTimestamp: 1753481739458,
    });
    const ctx: WorkflowOrchestratorContext = {
      eventsConsumer: new EventsConsumer([]),
      invocationsQueue: [],
      onWorkflowError(err) {
        workflowErrorReject(err);
      },
      globalThis: context.globalThis,
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
    expect((error as StepsNotRunError).steps).toMatchInlineSnapshot(`
      [
        {
          "args": [
            1,
            2,
          ],
          "invocationId": "d6f45471-b67f-4f0c-b60b-9ac709c285e1",
          "stepName": "add",
        },
      ]
    `);
  });

  it('should invoke workflow error handler if step is not run (concurrent)', async () => {
    let workflowErrorReject: (err: Error) => void;
    const workflowErrorPromise = new Promise<Error>((_, reject) => {
      workflowErrorReject = reject;
    });

    const context = createContext({
      seed: 'test',
      fixedTimestamp: 1753481739458,
    });
    const ctx: WorkflowOrchestratorContext = {
      eventsConsumer: new EventsConsumer([]),
      invocationsQueue: [],
      onWorkflowError(err) {
        workflowErrorReject(err);
      },
      globalThis: context.globalThis,
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
    expect((error as StepsNotRunError).steps).toMatchInlineSnapshot(`
      [
        {
          "args": [
            1,
            2,
          ],
          "invocationId": "d6f45471-b67f-4f0c-b60b-9ac709c285e1",
          "stepName": "add",
        },
        {
          "args": [
            3,
            4,
          ],
          "invocationId": "9ae6a38a-8447-4038-abcd-0ef772312266",
          "stepName": "add",
        },
        {
          "args": [
            5,
            6,
          ],
          "invocationId": "87228e82-3254-4b8b-9fc1-de64969755b5",
          "stepName": "add",
        },
      ]
    `);
  });
});
