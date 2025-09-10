import { sleep } from '@vercel/workflow-core';
import { pumpData } from './streams';

export async function example(writable: WritableStream) {
  'use workflow';
  console.log('example workflow', { writable });

  await pumpData(writable);
  writable.getWriter().close();
}

export async function sleepingWorkflow() {
  'use workflow';
  const startTime = Date.now();
  await sleep('10s');
  const endTime = Date.now();
  return { startTime, endTime };
}
