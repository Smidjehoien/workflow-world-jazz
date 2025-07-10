import { runInContext } from 'node:vm';
import { createContext } from '@vercel/workflow-vm';
import type { Event, WorkflowRun } from './backend.js';
import { createUseStep, type WorkflowContext } from './step.js';

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Appropriate for a rejection handler
  reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export async function runWorkflow(
  workflowCode: string,
  workflowRun: WorkflowRun,
  events: Event[]
): Promise<unknown> {
  // XXX: temporary logging
  console.log('Workflow run:', workflowRun);

  const startedAt = workflowRun.started_at;
  if (!startedAt) {
    throw new Error(
      `Workflow run "${workflowRun.id}" has no "started_at" timestamp (should not happen)`
    );
  }

  const { context } = createContext({
    seed: workflowRun.id,
    fixedTimestamp: +startedAt,
  });

  const workflowDiscontinuation = new Deferred<void>();

  // XXX: temporary logging
  console.log('Events:', events);

  const workflowContext: WorkflowContext = {
    stepIndex: 0,
    events,
    //invocationsQueue: [],
    onWorkflowError: workflowDiscontinuation.reject,
  };

  // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
  context[Symbol.for('WORKFLOW_USE_STEP')] = createUseStep(workflowContext);

  // Get a reference to the user-defined workflow function
  const workflowFn = runInContext(
    `${workflowCode};${workflowRun.workflow_name}`,
    context
  );

  if (typeof workflowFn !== 'function') {
    throw new ReferenceError(
      `Workflow ${JSON.stringify(workflowRun.workflow_name)} must be a function, but got "${typeof workflowFn}" instead`
    );
  }

  // Invoke user workflow
  return await Promise.race([
    workflowFn(...workflowRun.input),
    workflowDiscontinuation.promise,
  ]);
}
