import { start } from '@vercel/workflow-core/runtime';

export async function POST(req: Request) {
  const workflowId = 'example';
  const url = new URL(req.url);
  const argVal = url.searchParams.get('v');
  const arg = argVal ? parseFloat(argVal) : 42;
  const run = await start(workflowId, {
    arguments: [arg],
  });
  console.log('Run:', run);
  return new Response(
    `Starting "${workflowId}" workflow with run ID "${run.id}"`
  );
}
