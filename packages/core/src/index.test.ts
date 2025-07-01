import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStep, handleWorkflow, start } from './index';

// Mock external dependencies
vi.mock('@vercel/queue', () => ({
  send: vi.fn(),
  handleCallback: vi.fn(),
}));

describe('start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock crypto.randomUUID
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'test-run-id-123'),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should start a workflow with provided baseUrl', async () => {
    const { send } = await import('@vercel/queue');
    vi.mocked(send).mockResolvedValue({ messageId: 'test-message-id' });

    const result = await start('test-workflow', {
      baseUrl: 'https://example.com',
      arguments: ['arg1', 'arg2'],
    });

    expect(result).toEqual({ runId: 'test-run-id-123' });
    expect(send).toHaveBeenCalledWith(
      'workflow',
      {
        runId: 'test-run-id-123',
        callbackUrl: 'https://example.com/api/workflows/test-workflow',
        state: [{ t: expect.any(Number), arguments: ['arg1', 'arg2'] }],
      },
      {
        callback: {
          url: 'https://example.com/api/workflows/test-workflow',
        },
      }
    );
  });

  it('should infer baseUrl from VERCEL_URL environment variable', async () => {
    vi.stubEnv('VERCEL_URL', 'test.vercel.app');
    const { send } = await import('@vercel/queue');
    vi.mocked(send).mockResolvedValue({ messageId: 'test-message-id' });

    const result = await start('test-workflow');

    expect(result).toEqual({ runId: 'test-run-id-123' });
    expect(send).toHaveBeenCalledWith(
      'workflow',
      expect.objectContaining({
        callbackUrl: 'https://test.vercel.app/api/workflows/test-workflow',
      }),
      expect.any(Object)
    );
  });

  it('should add automation bypass secret to callback URL when available', async () => {
    vi.stubEnv('VERCEL_URL', 'test.vercel.app');
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'secret-123');
    const { send } = await import('@vercel/queue');
    vi.mocked(send).mockResolvedValue({ messageId: 'test-message-id' });

    await start('test-workflow');

    expect(send).toHaveBeenCalledWith(
      'workflow',
      expect.objectContaining({
        callbackUrl:
          'https://test.vercel.app/api/workflows/test-workflow?x-vercel-protection-bypass=secret-123',
      }),
      expect.any(Object)
    );
  });

  it('should throw error when no baseUrl provided and VERCEL_URL not set', async () => {
    await expect(start('test-workflow')).rejects.toThrow(
      'The `baseUrl` option must be provided'
    );
  });

  it('should use empty arguments array when not provided', async () => {
    const { send } = await import('@vercel/queue');
    vi.mocked(send).mockResolvedValue({ messageId: 'test-message-id' });

    await start('test-workflow', { baseUrl: 'https://example.com' });

    expect(send).toHaveBeenCalledWith(
      'workflow',
      expect.objectContaining({
        state: [{ t: expect.any(Number), arguments: [] }],
      }),
      expect.any(Object)
    );
  });
});

describe('handleWorkflow', () => {
  it.only('should return a handleCallback configuration', () => {
    const result = handleWorkflow('async function workflow () {}', 'workflow');

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should create workflow handler function', async () => {
    const { handleCallback } = await import('@vercel/queue');
    vi.mocked(handleCallback).mockImplementation((handlers) => handlers);

    handleWorkflow('const workflow = () => {}', 'workflow');

    expect(handleCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: expect.any(Function),
      })
    );
  });
});

describe('handleStep', () => {
  it('should return a handleCallback configuration', () => {
    const mockStepFn = vi.fn().mockResolvedValue('step-result');
    const result = handleStep(mockStepFn);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should create step handler function', async () => {
    const { handleCallback } = await import('@vercel/queue');
    vi.mocked(handleCallback).mockImplementation((handlers) => handlers);

    const mockStepFn = vi.fn().mockResolvedValue('step-result');
    handleStep(mockStepFn);

    expect(handleCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: expect.any(Function),
      })
    );
  });
});
