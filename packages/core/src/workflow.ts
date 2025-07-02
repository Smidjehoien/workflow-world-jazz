import { runInContext } from 'node:vm';
import { createContext } from '@vercel/workflow-vm';
import type { WorkflowInvokePayload } from './schemas.js';
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
  workflowName: string,
  message: WorkflowInvokePayload
): Promise<unknown> {
  const initialState = message.state[0];

  const { context } = createContext({
    seed: message.runId,
    fixedTimestamp: initialState.t,
  });

  const workflowDiscontinuation = new Deferred<void>();

  const workflowContext: WorkflowContext = {
    stepIndex: 1,
    state: message.state,
    invocationsQueue: [],
    onWorkflowError: workflowDiscontinuation.reject,
  };

  // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
  context[Symbol.for('WORKFLOW_USE_STEP')] = createUseStep(workflowContext);

  // Get a reference to the user-defined workflow function
  const workflowFn = runInContext(`${workflowCode};${workflowName}`, context);

  if (typeof workflowFn !== 'function') {
    throw new ReferenceError(
      `Workflow ${JSON.stringify(workflowName)} must be a function, but got "${typeof workflowFn}" instead`
    );
  }

  // Invoke user workflow
  return await Promise.race([
    workflowFn(...initialState.arguments),
    workflowDiscontinuation.promise,
  ]);
}
