import { example } from '@/workflows/workflows';

export async function POST(req: Request) {
  const { readable, writable } = new TransformStream();
  const result = await example(writable); // start()
  // => { runId: '123', status: 'queued' }
  console.log('got result', { result });
  return new Response(readable);
}
