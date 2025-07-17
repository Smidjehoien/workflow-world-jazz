import { start } from '@vercel/workflow-core/runtime';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const workflowId = url.searchParams.get('workflow') || 'example';
  const argVal = url.searchParams.get('args') || '42';
  const args = argVal.split(',').map((arg) => {
    const num = parseFloat(arg);
    return Number.isNaN(num) ? arg.trim() : num;
  });
  const run = await start(workflowId, args);
  console.log('Run:', run);
  return new Response(
    `Starting "${workflowId}" workflow with run ID "${run.id}"`
  );
}
