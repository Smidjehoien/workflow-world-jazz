import { sleepingWorkflow } from '@/workflows/workflows';

// So the response stream doesn't timeout
export const maxDuration = 800;

export async function GET(req: Request) {
  console.log('Starting sleepy workflow');
  await sleepingWorkflow();

  return Response.json({ started: true });
}
