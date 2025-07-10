import { describe, expect, it } from 'vitest';
import { FatalError, StepNotRunError } from './global.js';

describe('FatalError', () => {
  it('should create a FatalError instance', () => {
    const error = new FatalError('Test fatal error');

    expect(error).toBeInstanceOf(FatalError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test fatal error');
    expect(error.name).toBe('FatalError');
  });

  it('should have correct prototype chain', () => {
    const error = new FatalError('Test error');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof FatalError).toBe(true);
    expect(error.constructor).toBe(FatalError);
  });

  it('should have stack trace', () => {
    const error = new FatalError('Test error');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('FatalError');
    expect(error.stack).toContain('Test error');
  });
});

describe('StepNotRunError', () => {
  it('should create a StepNotRunError instance with basic properties', () => {
    const error = new StepNotRunError('test-step', ['arg1', 'arg2']);

    expect(error).toBeInstanceOf(StepNotRunError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('StepNotRunError');
    expect(error.stepName).toBe('test-step');
    expect(error.args).toEqual(['arg1', 'arg2']);
  });

  it('should generate correct error message', () => {
    const error = new StepNotRunError('test-step', [
      'arg1',
      42,
      { key: 'value' },
    ]);

    expect(error.message).toBe(
      'Step test-step has not been run yet. Arguments: ["arg1",42,{"key":"value"}]'
    );
  });

  it('should handle empty arguments array', () => {
    const error = new StepNotRunError('empty-step', []);

    expect(error.stepName).toBe('empty-step');
    expect(error.args).toEqual([]);
    expect(error.message).toBe(
      'Step empty-step has not been run yet. Arguments: []'
    );
  });

  it('should handle complex argument types', () => {
    const complexArgs = [
      'string',
      123,
      true,
      { nested: { object: 'value' } },
      [1, 2, 3],
      null,
      undefined,
    ];
    const error = new StepNotRunError('complex-step', complexArgs);

    expect(error.args).toEqual(complexArgs);
    expect(error.message).toContain('complex-step');
    expect(error.message).toContain('Arguments:');
  });

  it('should have correct prototype chain', () => {
    const error = new StepNotRunError('test-step', []);

    expect(error instanceof Error).toBe(true);
    expect(error instanceof StepNotRunError).toBe(true);
    expect(error.constructor).toBe(StepNotRunError);
  });

  it('should have stack trace', () => {
    const error = new StepNotRunError('test-step', ['arg']);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('StepNotRunError');
  });
});
