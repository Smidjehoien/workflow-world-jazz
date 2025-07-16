import { runInContext } from 'node:vm';
import { createContext } from '@vercel/workflow-vm';
import type { Event, WorkflowRun } from './backend.js';
import { EventConsumerResult, EventsConsumer } from './events-consumer.js';
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
  //console.log('Workflow run:', workflowRun);

  const startedAt = workflowRun.started_at;
  if (!startedAt) {
    throw new Error(
      `Workflow run "${workflowRun.id}" has no "started_at" timestamp (should not happen)`
    );
  }

  const { context, updateTimestamp } = createContext({
    seed: workflowRun.id,
    fixedTimestamp: +startedAt,
  });

  const workflowDiscontinuation = new Deferred<void>();

  // XXX: temporary logging
  //console.log('Events:', events);

  const workflowContext: WorkflowContext = {
    onWorkflowError: workflowDiscontinuation.reject,
    randomUUID: context.crypto.randomUUID,
    eventsConsumer: new EventsConsumer(events),
    invocationsQueue: [],
  };

  // Subscribe to the events log to update the timestamp in the vm context
  workflowContext.eventsConsumer.subscribe((event) => {
    const createdAt = event?.created_at;
    if (createdAt) {
      updateTimestamp(+createdAt);
    }
    // Never consume events - this is only a passive subscriber
    return EventConsumerResult.NotConsumed;
  });

  const useStep = createUseStep(workflowContext);

  // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
  context[Symbol.for('WORKFLOW_USE_STEP')] = useStep;

  // Provide a hoisted fetch function
  const fetchStep = useStep<any[], Response>('__builtin_fetch');
  context.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await fetchStep(...args);
    Object.setPrototypeOf(res, Response.prototype);
    res.headers = new Headers(res.headers);
    return res;
  };

  // `Response` is a special built-in class that invokes steps
  // for the `json()` and `text()` instance methods
  const resJson = useStep<[any], any>('__builtin_response_json');
  const resText = useStep<[any], string>('__builtin_response_text');
  class Response {
    status!: number;
    statusText!: string;
    body!: ReadableStream<Uint8Array>;
    headers!: Headers;

    get ok() {
      return this.status >= 200 && this.status < 300;
    }

    async json() {
      return resJson(this);
    }

    async text() {
      return resText(this);
    }
  }
  context.Response = Response;

  // Additional Web APIs that can be used in the workflow function which don't need any special handling
  context.Headers = globalThis.Headers;
  context.structuredClone = globalThis.structuredClone;

  // HACK: propagate symbol needed for AI gateway usage
  const SYMBOL_FOR_REQ_CONTEXT = Symbol.for('@vercel/request-context');
  // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
  context[SYMBOL_FOR_REQ_CONTEXT] = (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT];

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
