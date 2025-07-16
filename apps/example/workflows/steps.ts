import { FatalError } from '@vercel/workflow-core';

export async function add(a: number, b: number): Promise<number> {
  'use step';

  // Mimic a retryable error 50% of the time
  if (Math.random() < 0.5) {
    throw new Error('Retryable error');
  }

  // Mimic a 5% chance of the workflow actually failing
  if (Math.random() < 0.05) {
    throw new FatalError("We're cooked yo!");
  }

  return a + b;
}

export async function sleep(ms: number, message: string): Promise<string> {
  'use step';
  console.log(`Sleeping for ${ms}ms`);
  await new Promise((resolve) => setTimeout(resolve, ms));
  return message;
}

export async function genStream(): Promise<ReadableStream<Uint8Array>> {
  'use step';
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for (let i = 0; i < 30; i++) {
        const chunk = encoder.encode(`${i}\n`);
        controller.enqueue(chunk);
        console.log(`Enqueued number: ${i}`);
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      controller.close();
    },
  });
  return stream;
}

export async function consumeStream(
  s1: ReadableStream<Uint8Array>,
  s2: ReadableStream<Uint8Array>
): Promise<string> {
  'use step';
  const parts: Uint8Array[] = [];
  await Promise.all(
    [s1, s2].map(async (s) => {
      const reader = s.getReader();
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        console.log(
          `Received ${result.value.length} bytes: ${JSON.stringify(new TextDecoder().decode(result.value))}`
        );
        parts.push(result.value);
      }
    })
  );
  return Buffer.concat(parts).toString('utf8');
}
