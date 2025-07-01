import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FatalError, STATE, STEP_INDEX, StepNotRunError } from './global';
import { useStep } from './step';

describe('useStep', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      [STEP_INDEX]: 1,
      [STATE]: [],
    };
  });

  it('should throw error when context is invalid (no STEP_INDEX)', async () => {
    const invalidContext = {};
    const stepFn = useStep<[string], string>('test-step', invalidContext);

    await expect(stepFn('test')).rejects.toThrow(
      'Invalid context: `useStep` must be called from a within a workflow execution environment'
    );
  });

  it('should increment step index when called', async () => {
    mockContext[STATE] = [null, { result: 'test-result' }];
    const stepFn = useStep<[string], string>('test-step', mockContext);

    const result = await stepFn('test');

    expect(mockContext[STEP_INDEX]).toBe(2);
    expect(result).toBe('test-result');
  });

  it('should return result when step has already completed', async () => {
    mockContext[STATE] = [null, { result: 'completed-result' }];
    const stepFn = useStep<[string], string>('test-step', mockContext);

    const result = await stepFn('test');

    expect(result).toBe('completed-result');
  });

  it('should throw FatalError when step failed with fatal error', async () => {
    mockContext[STATE] = [null, { error: 'Fatal step error', fatal: true }];
    const stepFn = useStep<[string], string>('test-step', mockContext);

    await expect(stepFn('test')).rejects.toThrow(FatalError);
    await expect(stepFn('test')).rejects.toThrow('Fatal step error');
  });

  it('should throw regular Error when step failed with non-fatal error', async () => {
    mockContext[STATE] = [null, { error: 'Regular step error' }];
    const stepFn = useStep<[string], string>('test-step', mockContext);

    await expect(stepFn('test')).rejects.toThrow(Error);
    await expect(stepFn('test')).rejects.toThrow('Regular step error');
    // Should not throw FatalError
    await expect(stepFn('test')).rejects.not.toThrow(FatalError);
  });

  it('should throw StepNotRunError when step has not been executed', async () => {
    mockContext[STATE] = [null]; // No event at step index 1
    const stepFn = useStep<[string, number], string>('test-step', mockContext);

    await expect(stepFn('test', 123)).rejects.toThrow(StepNotRunError);

    try {
      await stepFn('test', 123);
    } catch (error) {
      expect(error).toBeInstanceOf(StepNotRunError);
      if (error instanceof StepNotRunError) {
        expect(error.stepId).toBe('test-step');
        expect(error.args).toEqual(['test', 123]);
      }
    }
  });

  it('should work with globalThis as default context', async () => {
    // Set up globalThis context
    (globalThis as any)[STEP_INDEX] = 1;
    (globalThis as any)[STATE] = [null, { result: 'global-result' }];

    const stepFn = useStep<[string], string>('test-step');

    const result = await stepFn('test');

    expect(result).toBe('global-result');
    expect((globalThis as any)[STEP_INDEX]).toBe(2);

    // Clean up
    delete (globalThis as any)[STEP_INDEX];
    delete (globalThis as any)[STATE];
  });

  it('should handle multiple sequential step calls with different step indices', async () => {
    mockContext[STATE] = [
      null, // trigger event
      { result: 'first-result' }, // step 1
      { result: 'second-result' }, // step 2
    ];
    mockContext[STEP_INDEX] = 1;

    const firstStep = useStep<[string], string>('first-step', mockContext);
    const firstResult = await firstStep('test1');

    const secondStep = useStep<[string], string>('second-step', mockContext);
    const secondResult = await secondStep('test2');

    expect(firstResult).toBe('first-result');
    expect(secondResult).toBe('second-result');
    expect(mockContext[STEP_INDEX]).toBe(3);
  });

  it('should handle empty state array correctly', async () => {
    mockContext[STATE] = [];
    const stepFn = useStep<[string], string>('test-step', mockContext);

    await expect(stepFn('test')).rejects.toThrow(StepNotRunError);
  });
});
