import { FatalError, getWebhook, sleep } from '@vercel/workflow-core';

//////////////////////////////////////////////////////////

async function add(a: number, b: number) {
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
    specificDelay(2000, 'a'),
    specificDelay(100, 'b'), // "b" should always win
    specificDelay(3000, 'c'),
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

async function genStream() {
  'use step';
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(encoder.encode(`${i}\n`));
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      controller.close();
    },
  });
}

export async function readableStreamWorkflow() {
  'use workflow';
  const stream = await genStream();
  return stream;
}

//////////////////////////////////////////////////////////

export async function namedWebhookWorkflow() {
  'use workflow';
  const webhook = getWebhook({
    url: '/api/e2e/webhook',
    method: ['GET', 'POST', 'DELETE'],
  });

  const requests: {
    method: string;
    headers: Record<string, string>;
    body: any;
  }[] = [];
  for await (const request of webhook) {
    requests.push({
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
    });

    if (request.method === 'DELETE') {
      // The DELETE request will be the last one, so break out of the loop
      break;
    }
  }
  return requests;
}

//////////////////////////////////////////////////////////

export async function sleepingWorkflow() {
  'use workflow';
  const startTime = Date.now();
  await sleep('10s');
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
