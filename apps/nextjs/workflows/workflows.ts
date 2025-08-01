import { pumpData } from './streams';

export async function example(writable: WritableStream) {
  'use workflow';
  console.log('example workflow', { writable });

  await pumpData(writable);
  writable.getWriter().close();
}
