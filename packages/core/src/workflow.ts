import { runInContext } from 'node:vm';
import { createContext } from '@vercel/workflow-vm';
import type { Event, WorkflowRun } from './backend.js';
import { EventConsumerResult, EventsConsumer } from './events-consumer.js';
import {
  dehydrateWorkflowReturnValue,
  hydrateWorkflowArguments,
} from './serialization.js';
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

  const {
    context,
    globalThis: vmGlobalThis,
    updateTimestamp,
  } = createContext({
    seed: workflowRun.id,
    fixedTimestamp: +startedAt,
  });

  const workflowDiscontinuation = new Deferred<void>();

  // XXX: temporary logging
  //console.log('Events:', events);

  const workflowContext: WorkflowContext = {
    globalThis: vmGlobalThis,
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
  context.fetch = useStep<any[], Response>('__builtin_fetch');

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
  // we need the Response on globalThis to match for
  // instanceof checks context doesn't do this automatically
  vmGlobalThis.Response = Response as any;

  // Eventually we'll probably want to provide our own `console` object,
  // but for now we'll just expose the global one.
  context.console = globalThis.console;

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

  // XXX: temporary logging
  console.log('Dehydrated Args:', workflowRun.input);

  const ops: Promise<any>[] = [];

  const args = hydrateWorkflowArguments(workflowRun.input, ops, vmGlobalThis);

  // XXX: temporary logging
  console.log('Hydrated Args:', args);

  // Invoke user workflow
  const result = await Promise.race([
    workflowFn(...args),
    workflowDiscontinuation.promise,
  ]);

  // XXX: temporary logging
  console.log('Result:', result);

  const dehydrated = dehydrateWorkflowReturnValue(result, vmGlobalThis);

  // XXX: temporary logging
  console.log('Dehydrated Result:', dehydrated);

  return dehydrated;
}
