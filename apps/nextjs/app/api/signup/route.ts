import { example } from '@/lib/workflows';

export async function POST(req: Request) {
  const result = await example(1); // start()
  // => { runId: '123', status: 'queued' }

  return Response.json(result);
}
