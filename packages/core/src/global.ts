import type { Serializable } from './schemas.js';

export interface StepInvocationQueueItem {
  type: 'step';
  correlationId: string;
  stepName: string;
  args: Serializable[];
}

export interface WebhookInvocationQueueItem {
  type: 'webhook';
  correlationId: string;
  url?: string;
  allowedMethods?: string[];
  searchParamsSchema?: Record<string, any>;
  headersSchema?: Record<string, any>;
  bodySchema?: Record<string, any>;
}

export interface HookInvocationQueueItem {
  type: 'hook';
  correlationId: string;
  token: string;
}

export type QueueItem =
  | StepInvocationQueueItem
  | WebhookInvocationQueueItem
  | HookInvocationQueueItem;

/**
 * An error that is thrown when one or more operations (steps/hooks/etc.) are called but do
 * not yet have corresponding entries in the event log. The workflow
 * dispatcher will catch this error and push the operations
 * onto the queue.
 */
export class WorkflowSuspension extends Error {
  steps: QueueItem[];
  globalThis: typeof globalThis;
  stepCount: number;
  webhookCount: number;
  hookCount: number;

  constructor(steps: QueueItem[], global: typeof globalThis) {
    const stepCount = steps.filter((s) => s.type === 'step').length;
    const webhookCount = steps.filter((s) => s.type === 'webhook').length;
    const hookCount = steps.filter((s) => s.type === 'hook').length;

    // Build description parts
    const parts: string[] = [];
    if (stepCount > 0) {
      parts.push(`${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`);
    }
    if (webhookCount > 0) {
      parts.push(
        `${webhookCount} ${webhookCount === 1 ? 'webhook' : 'webhooks'}`
      );
    }
    if (hookCount > 0) {
      parts.push(`${hookCount} ${hookCount === 1 ? 'hook' : 'hooks'}`);
    }

    // Determine verb (has/have) and action (run/created/received)
    const totalCount = stepCount + webhookCount + hookCount;
    const hasOrHave = totalCount === 1 ? 'has' : 'have';
    let action: string;
    if (stepCount > 0) {
      action = 'run';
    } else if (webhookCount > 0) {
      action = 'created';
    } else {
      action = 'received';
    }

    const description =
      parts.length > 0
        ? `${parts.join(' and ')} ${hasOrHave} not been ${action} yet`
        : '0 steps have not been run yet'; // Default case for empty array
    super(description);
    this.name = 'WorkflowSuspension';
    this.steps = steps;
    this.globalThis = global;
    this.stepCount = stepCount;
    this.webhookCount = webhookCount;
    this.hookCount = hookCount;
  }
}

export function ENOTSUP(): never {
  throw new Error('Not supported in workflow functions');
}
