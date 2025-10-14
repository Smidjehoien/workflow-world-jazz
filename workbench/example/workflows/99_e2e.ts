import {
  createHook,
  createWebhook,
  FatalError,
  fetch,
  getStepMetadata,
  getWorkflowMetadata,
  getWritable,
  type RequestWithResponse,
  sleep,
} from '@vercel/workflow';

//////////////////////////////////////////////////////////

export async function add(a: number, b: number) {
  'use step';
  return a + b;
}

export async function addTenWorkflow(input: number) {
  'use workflow';
  const a = await add(input, 2);
  const b = await add(a, 3);
  const c = await add(b, 5);
  return c;
}

//////////////////////////////////////////////////////////

async function randomDelay(v: string) {
  'use step';
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 3000));
  return v.toUpperCase();
}

export async function promiseAllWorkflow() {
  'use workflow';
  const [a, b, c] = await Promise.all([
    randomDelay('a'),
    randomDelay('b'),
    randomDelay('c'),
  ]);
  return a + b + c;
}

//////////////////////////////////////////////////////////

async function specificDelay(delay: number, v: string) {
  'use step';
  await new Promise((resolve) => setTimeout(resolve, delay));
  return v.toUpperCase();
}

export async function promiseRaceWorkflow() {
  'use workflow';
  const winner = await Promise.race([
    specificDelay(10000, 'a'),
    specificDelay(100, 'b'), // "b" should always win
    specificDelay(20000, 'c'),
  ]);
  return winner;
}

//////////////////////////////////////////////////////////

async function stepThatFails() {
  'use step';
  throw new FatalError('step failed');
}

export async function promiseAnyWorkflow() {
  'use workflow';
  const winner = await Promise.any([
    stepThatFails(),
    specificDelay(1000, 'b'), // "b" should always win
    specificDelay(3000, 'c'),
  ]);
  return winner;
}

//////////////////////////////////////////////////////////

// Name should not conflict with genStream in 3_streams.ts
// TODO: swc transform should mangle names to avoid conflicts
async function genReadableStream() {
  'use step';
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        console.log('enqueueing', i);
        controller.enqueue(encoder.encode(`${i}\n`));
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      console.log('closing controller');
      controller.close();
    },
  });
}

export async function readableStreamWorkflow() {
  'use workflow';
  console.log('calling genReadableStream');
  const stream = await genReadableStream();
  console.log('genReadableStream returned', stream);
  return stream;
}

//////////////////////////////////////////////////////////

export async function hookWorkflow(token: string) {
  'use workflow';

  type Payload = { message: string; done?: boolean };

  const hook = createHook<Payload>({ token });

  const payloads: Payload[] = [];
  for await (const payload of hook) {
    payloads.push(payload);

    if (payload.done) {
      break;
    }
  }

  return payloads;
}

//////////////////////////////////////////////////////////

async function sendWebhookResponse(req: RequestWithResponse) {
  'use step';
  const body = await req.text();
  await req.respondWith(new Response('Hello from webhook!', { status: 202 }));
  return body;
}

export async function webhookWorkflow(token: string) {
  'use workflow';

  const webhook = createWebhook({ token });

  const req = await webhook;

  const body = await sendWebhookResponse(req);

  return {
    token: webhook.token,
    url: req.url,
    method: req.method,
    body,
  };
}

//////////////////////////////////////////////////////////

export async function sleepingWorkflow() {
  'use workflow';
  const startTime = Date.now();
  await sleep('10s');
  const endTime = Date.now();
  return { startTime, endTime };
}

export async function sleepingDateWorkflow(endDate: Date) {
  'use workflow';
  const startTime = Date.now();
  await sleep(endDate);
  const endTime = Date.now();
  return { startTime, endTime };
}

//////////////////////////////////////////////////////////

async function nullByteStep() {
  'use step';
  return 'null byte \0';
}

export async function nullByteWorkflow() {
  'use workflow';
  const a = await nullByteStep();
  return a;
}

//////////////////////////////////////////////////////////

async function stepWithMetadata() {
  'use step';
  const stepMetadata = getStepMetadata();
  const workflowMetadata = getWorkflowMetadata();
  return { stepMetadata, workflowMetadata };
}

export async function workflowAndStepMetadataWorkflow() {
  'use workflow';
  const workflowMetadata = getWorkflowMetadata();
  const { stepMetadata, workflowMetadata: innerWorkflowMetadata } =
    await stepWithMetadata();
  return {
    workflowMetadata: {
      workflowRunId: workflowMetadata.workflowRunId,
      workflowStartedAt: workflowMetadata.workflowStartedAt,
      url: workflowMetadata.url,
    },
    stepMetadata,
    innerWorkflowMetadata,
  };
}

//////////////////////////////////////////////////////////

async function stepWithOutputStreamBinary(
  writable: WritableStream,
  text: string
) {
  'use step';
  const writer = writable.getWriter();
  // binary data
  await writer.write(new TextEncoder().encode(text));
  writer.releaseLock();
}

async function stepWithOutputStreamObject(writable: WritableStream, obj: any) {
  'use step';
  const writer = writable.getWriter();
  // object data
  await writer.write(obj);
  writer.releaseLock();
}

async function stepCloseOutputStream(writable: WritableStream) {
  'use step';
  await writable.close();
}

export async function outputStreamWorkflow() {
  'use workflow';
  const writable = getWritable();
  const namedWritable = getWritable({ namespace: 'test' });
  await sleep('1s');
  await stepWithOutputStreamBinary(writable, 'Hello, world!');
  await sleep('1s');
  await stepWithOutputStreamBinary(namedWritable, 'Hello, named stream!');
  await sleep('1s');
  await stepWithOutputStreamObject(writable, { foo: 'test' });
  await sleep('1s');
  await stepWithOutputStreamObject(namedWritable, { foo: 'bar' });
  await sleep('1s');
  await stepCloseOutputStream(writable);
  await stepCloseOutputStream(namedWritable);
  return 'done';
}

//////////////////////////////////////////////////////////

export async function fetchWorkflow() {
  'use workflow';
  const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
  const data = await response.json();
  return data;
}

//////////////////////////////////////////////////////////

export async function promiseRaceStressTestDelayStep(
  dur: number,
  resp: number
): Promise<number> {
  'use step';

  console.log(`sleep`, resp, `/`, dur);
  await new Promise((resolve) => setTimeout(resolve, dur));

  console.log(resp, `done`);
  return resp;
}

export async function promiseRaceStressTestWorkflow() {
  'use workflow';

  const promises = new Map<number, Promise<number>>();
  const done: number[] = [];
  for (let i = 0; i < 5; i++) {
    const resp = i;
    const dur = 1000 * 5 * i; // 5 seconds apart
    console.log(`sched`, resp, `/`, dur);
    promises.set(i, promiseRaceStressTestDelayStep(dur, resp));
  }

  while (promises.size > 0) {
    console.log(`promises.size`, promises.size);
    const res = await Promise.race(promises.values());
    console.log(res);
    done.push(res);
    promises.delete(res);
  }

  return done;
}
