import { describe, expect, it } from 'vitest';
import type {
  StepInvokePayload,
  WorkflowEvent,
  WorkflowEventCommon,
  WorkflowInvokePayload,
  WorkflowStepFatalError,
  WorkflowStepResult,
  WorkflowTriggerEvent,
} from './schemas';

describe('Schema Types', () => {
  describe('WorkflowTriggerEvent', () => {
    it('should accept valid trigger event structure', () => {
      const triggerEvent: WorkflowTriggerEvent = {
        arguments: ['arg1', 42, { key: 'value' }],
      };

      expect(triggerEvent.arguments).toEqual(['arg1', 42, { key: 'value' }]);
    });

    it('should accept empty arguments', () => {
      const triggerEvent: WorkflowTriggerEvent = {
        arguments: [],
      };

      expect(triggerEvent.arguments).toEqual([]);
    });
  });

  describe('WorkflowStepResult', () => {
    it('should accept any result type', () => {
      const stepResult: WorkflowStepResult = {
        result: 'string result',
      };

      expect(stepResult.result).toBe('string result');
    });

    it('should accept complex result types', () => {
      const complexResult = { data: [1, 2, 3], status: 'success' };
      const stepResult: WorkflowStepResult = {
        result: complexResult,
      };

      expect(stepResult.result).toEqual(complexResult);
    });
  });

  describe('WorkflowStepFatalError', () => {
    it('should require fatal flag to be true', () => {
      const fatalError: WorkflowStepFatalError = {
        error: 'Something went wrong',
        fatal: true,
      };

      expect(fatalError.error).toBe('Something went wrong');
      expect(fatalError.fatal).toBe(true);
    });

    it('should accept optional stack trace', () => {
      const fatalError: WorkflowStepFatalError = {
        error: 'Error with stack',
        stack: 'Error: Something went wrong\n    at ...',
        fatal: true,
      };

      expect(fatalError.error).toBe('Error with stack');
      expect(fatalError.stack).toContain('Error: Something went wrong');
      expect(fatalError.fatal).toBe(true);
    });
  });

  describe('WorkflowEventCommon', () => {
    it('should add timestamp to any event type', () => {
      const timestamp = Date.now();
      const event: WorkflowEventCommon<WorkflowStepResult> = {
        result: 'test result',
        t: timestamp,
      };

      expect(event.result).toBe('test result');
      expect(event.t).toBe(timestamp);
    });
  });

  describe('WorkflowEvent', () => {
    it('should accept step result event', () => {
      const event: WorkflowEvent = {
        result: 'success',
        t: Date.now(),
      };

      expect(event.result).toBe('success');
      expect(event.t).toBeDefined();
    });

    it('should accept fatal error event', () => {
      const event: WorkflowEvent = {
        error: 'Fatal error occurred',
        fatal: true,
        t: Date.now(),
      };

      expect((event as WorkflowEventCommon<WorkflowStepFatalError>).error).toBe(
        'Fatal error occurred'
      );
      expect((event as WorkflowEventCommon<WorkflowStepFatalError>).fatal).toBe(
        true
      );
    });
  });

  describe('WorkflowInvokePayload', () => {
    it('should accept valid workflow invoke payload', () => {
      const payload: WorkflowInvokePayload = {
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/callback',
        state: [
          { t: Date.now(), arguments: ['arg1', 'arg2'] },
          { t: Date.now(), result: 'step1 result' },
        ],
      };

      expect(payload.runId).toBe('test-run-123');
      expect(payload.callbackUrl).toBe('https://example.com/callback');
      expect(payload.state).toHaveLength(2);
      expect(payload.state[0].arguments).toEqual(['arg1', 'arg2']);
    });

    it('should require at least one trigger event in state', () => {
      const payload: WorkflowInvokePayload = {
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/callback',
        state: [{ t: Date.now(), arguments: [] }],
      };

      expect(payload.state).toHaveLength(1);
      expect(payload.state[0].arguments).toEqual([]);
    });
  });

  describe('StepInvokePayload', () => {
    it('should extend WorkflowInvokePayload with step-specific fields', () => {
      const payload: StepInvokePayload = {
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/callback',
        state: [{ t: Date.now(), arguments: ['initial'] }],
        stepId: 'test-step',
        arguments: ['step', 'args'],
      };

      expect(payload.runId).toBe('test-run-123');
      expect(payload.stepId).toBe('test-step');
      expect(payload.arguments).toEqual(['step', 'args']);
      expect(payload.state[0].arguments).toEqual(['initial']);
    });

    it('should accept empty step arguments', () => {
      const payload: StepInvokePayload = {
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/callback',
        state: [{ t: Date.now(), arguments: [] }],
        stepId: 'empty-step',
        arguments: [],
      };

      expect(payload.stepId).toBe('empty-step');
      expect(payload.arguments).toEqual([]);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow workflow events to be used in state arrays', () => {
      const stepResult: WorkflowEvent = {
        result: 'test',
        t: Date.now(),
      };

      const fatalError: WorkflowEvent = {
        error: 'fatal',
        fatal: true,
        t: Date.now(),
      };

      const state: WorkflowInvokePayload['state'] = [
        { t: Date.now(), arguments: [] },
        stepResult,
        fatalError,
      ];

      expect(state).toHaveLength(3);
      expect(state[1].result).toBe('test');
      expect(
        (state[2] as WorkflowEventCommon<WorkflowStepFatalError>).error
      ).toBe('fatal');
    });
  });
});
