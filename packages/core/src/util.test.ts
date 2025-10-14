import { describe, expect, it } from 'vitest';
import { buildWorkflowSuspensionMessage } from './util';

describe('buildWorkflowSuspensionMessage', () => {
  const runId = 'test-run-123';

  it('should return null when both counts are zero', () => {
    const result = buildWorkflowSuspensionMessage(runId, 0, 0);
    expect(result).toBeNull();
  });

  it('should handle single step', () => {
    const result = buildWorkflowSuspensionMessage(runId, 1, 0);
    expect(result).toBe(
      `[Workflows] "${runId}" - 1 step to be enqueued\n  Workflow will suspend and resume when steps are created`
    );
  });

  it('should handle multiple steps', () => {
    const result = buildWorkflowSuspensionMessage(runId, 3, 0);
    expect(result).toBe(
      `[Workflows] "${runId}" - 3 steps to be enqueued\n  Workflow will suspend and resume when steps are created`
    );
  });

  it('should handle single hook', () => {
    const result = buildWorkflowSuspensionMessage(runId, 0, 1);
    expect(result).toBe(
      `[Workflows] "${runId}" - 1 hook to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });

  it('should handle multiple hooks', () => {
    const result = buildWorkflowSuspensionMessage(runId, 0, 2);
    expect(result).toBe(
      `[Workflows] "${runId}" - 2 hooks to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });

  it('should handle single step and single hook', () => {
    const result = buildWorkflowSuspensionMessage(runId, 1, 1);
    expect(result).toBe(
      `[Workflows] "${runId}" - 1 step and 1 hook to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });

  it('should handle multiple steps and single hook', () => {
    const result = buildWorkflowSuspensionMessage(runId, 5, 1);
    expect(result).toBe(
      `[Workflows] "${runId}" - 5 steps and 1 hook to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });

  it('should handle single step and multiple hooks', () => {
    const result = buildWorkflowSuspensionMessage(runId, 1, 3);
    expect(result).toBe(
      `[Workflows] "${runId}" - 1 step and 3 hooks to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });

  it('should handle multiple steps and multiple hooks', () => {
    const result = buildWorkflowSuspensionMessage(runId, 4, 2);
    expect(result).toBe(
      `[Workflows] "${runId}" - 4 steps and 2 hooks to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });

  it('should handle large numbers correctly', () => {
    const result = buildWorkflowSuspensionMessage(runId, 100, 50);
    expect(result).toBe(
      `[Workflows] "${runId}" - 100 steps and 50 hooks to be enqueued\n  Workflow will suspend and resume when steps are created and hooks are triggered`
    );
  });
});
