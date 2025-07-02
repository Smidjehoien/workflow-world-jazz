//import { sleep } from '@vercel/workflow-core';
import { add } from './steps.ts';

export async function example(i: number) {
  'use workflow';
  const a = await add(i, 7);
  //await sleep('5 seconds');
  const b = await add(a, 8);
  return b;
}
