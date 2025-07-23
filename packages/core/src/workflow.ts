import { runInContext } from 'node:vm';
import { createContext } from '@vercel/workflow-vm';
import type { Event, WorkflowRun } from './backend.js';
import { EventConsumerResult, EventsConsumer } from './events-consumer.js';
import { ENOTSUP } from './global.js';
import {
  dehydrateWorkflowReturnValue,
  hydrateWorkflowArguments,
} from './serialization.js';
import { createUseStep, type WorkflowContext } from './step.js';

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
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
  vmGlobalThis[Symbol.for('WORKFLOW_USE_STEP')] = useStep;

  // @ts-ignore Provide a hoisted fetch function
  vmGlobalThis.fetch = useStep<any[], Response>('__builtin_fetch');

  // `Response` is a special built-in class that invokes steps
  // for the `json()`, `text()` and `arrayBuffer()` instance methods
  const resJson = useStep<[any], any>('__builtin_response_json');
  const resText = useStep<[any], string>('__builtin_response_text');
  const resArrayBuffer = useStep<[any], ArrayBuffer>(
    '__builtin_response_array_buffer'
  );
  class Response implements globalThis.Response {
    type!: globalThis.Response['type'];
    url!: string;
    status!: number;
    statusText!: string;
    body!: ReadableStream<Uint8Array>;
    headers!: Headers;
    redirected!: boolean;

    // TODO: implement these
    clone!: () => Response;
    blob!: () => Promise<globalThis.Blob>;
    formData!: () => Promise<globalThis.FormData>;

    get ok() {
      return this.status >= 200 && this.status < 300;
    }

    get bodyUsed() {
      return false;
    }

    async arrayBuffer() {
      return resArrayBuffer(this);
    }

    async json() {
      return resJson(this);
    }

    static json(): Response {
      ENOTSUP();
    }

    async text() {
      return resText(this);
    }

    static error(): Response {
      ENOTSUP();
    }

    static redirect(_url: string, _status: number = 302): Response {
      ENOTSUP();
    }
  }
  vmGlobalThis.Response = Response;

  class ReadableStream<T> implements globalThis.ReadableStream<T> {
    constructor() {
      ENOTSUP();
    }

    get locked() {
      return false;
    }

    cancel(): any {
      ENOTSUP();
    }

    getReader(): any {
      ENOTSUP();
    }

    pipeThrough(): any {
      ENOTSUP();
    }

    pipeTo(): any {
      ENOTSUP();
    }

    tee(): any {
      ENOTSUP();
    }

    values(): any {
      ENOTSUP();
    }

    static from(): any {
      ENOTSUP();
    }

    [Symbol.asyncIterator](): any {
      ENOTSUP();
    }
  }
  vmGlobalThis.ReadableStream = ReadableStream;

  class WritableStream<T> implements globalThis.WritableStream<T> {
    constructor() {
      ENOTSUP();
    }

    get locked() {
      return false;
    }

    abort(): any {
      ENOTSUP();
    }

    close(): any {
      ENOTSUP();
    }

    getWriter(): any {
      ENOTSUP();
    }
  }
  vmGlobalThis.WritableStream = WritableStream;

  class TransformStream<I, O> implements globalThis.TransformStream<I, O> {
    readable: globalThis.ReadableStream<O>;
    writable: globalThis.WritableStream<I>;

    constructor() {
      ENOTSUP();
    }
  }
  vmGlobalThis.TransformStream = TransformStream;

  // Eventually we'll probably want to provide our own `console` object,
  // but for now we'll just expose the global one.
  vmGlobalThis.console = globalThis.console;

  // HACK: propagate symbol needed for AI gateway usage
  const SYMBOL_FOR_REQ_CONTEXT = Symbol.for('@vercel/request-context');
  // @ts-expect-error - `@types/node` says symbol is not valid, but it does work
  vmGlobalThis[SYMBOL_FOR_REQ_CONTEXT] = (globalThis as any)[
    SYMBOL_FOR_REQ_CONTEXT
  ];

  // Get a reference to the user-defined workflow function
  const workflowFn = runInContext(
    `${workflowCode};${workflowRun.workflow_name}`,
    context
  );

  if (typeof workflowFn !== 'function') {
    throw new ReferenceError(
      `Workflow ${JSON.stringify(
        workflowRun.workflow_name
      )} must be a function, but got "${typeof workflowFn}" instead`
    );
  }

  const args = hydrateWorkflowArguments(workflowRun.input, vmGlobalThis);

  // Invoke user workflow
  const result = await Promise.race([
    workflowFn(...args),
    workflowDiscontinuation.promise,
  ]);

  const dehydrated = dehydrateWorkflowReturnValue(result, vmGlobalThis);
  return dehydrated;
}
