import { describe, expect, it, vi } from 'vitest';
import { FatalError, StepNotRunError } from './global.js';
import { createUseStep, type WorkflowContext } from './step.js';

describe('createUseStep', () => {
  it('should resolve with the result of a step', async () => {
    const ctx: WorkflowContext = {
      stepIndex: 1,
      events: [
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'workflow_started',
          event_data: {},
          sequence_number: 0,
          created_at: new Date(),
        },
        {
          id: 'event-1',
          workflow_run_id: 'run-123',
          event_type: 'step_result',
          event_data: { result: 3 },
          sequence_number: 1,
          created_at: new Date(),
        },
      ],
      onWorkflowError: vi.fn(),
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    const result = await add(1, 2);
    expect(result).toBe(3);
    expect(ctx.onWorkflowError).not.toHaveBeenCalled();
  });

  it('should reject with a fatal error if the step fails', async () => {
    const ctx: WorkflowContext = {
      stepIndex: 1,
      events: [
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'workflow_started',
          event_data: {},
          sequence_number: 0,
          created_at: new Date(),
        },
        {
          id: 'event-1',
          workflow_run_id: 'run-123',
          event_type: 'step_failed',
          event_data: { error: 'test', fatal: true },
          sequence_number: 1,
          created_at: new Date(),
        },
      ],
      onWorkflowError: vi.fn(),
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
      stepIndex: 1,
      events: [
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'workflow_started',
          event_data: {},
          sequence_number: 0,
          created_at: new Date(),
        },
      ],
      onWorkflowError(err) {
        workflowErrorReject(err);
      },
    };
    const useStep = createUseStep(ctx);
    const add = useStep('add');
    let error: Error | undefined;
    try {
      await Promise.race([add(1, 2), workflowErrorPromise]);
    } catch (err_) {
      error = err_ as Error;
    }
    expect(error).toBeInstanceOf(StepNotRunError);
    expect((error as StepNotRunError).args).toEqual([1, 2]);
    expect((error as StepNotRunError).stepName).toBe('add');
  });

  it('should invoke workflow error handler if step is not run (concurrent)', async () => {
    let workflowErrorReject: (err: Error) => void;
    const workflowErrorPromise = new Promise<Error>((_, reject) => {
      workflowErrorReject = reject;
    });

    const ctx: WorkflowContext = {
      stepIndex: 1,
      events: [
        {
          id: 'event-0',
          workflow_run_id: 'run-123',
          event_type: 'workflow_started',
          event_data: {},
          sequence_number: 0,
          created_at: new Date(),
        },
      ],
      onWorkflowError(err) {
        workflowErrorReject(err);
      },
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
    expect(error).toBeInstanceOf(StepNotRunError);
    expect((error as StepNotRunError).args).toEqual([1, 2]);
    expect((error as StepNotRunError).stepName).toBe('add');
    // Note: invocationsQueue is not currently implemented in the step context
  });
});
