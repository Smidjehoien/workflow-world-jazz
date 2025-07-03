import { sleep } from '@vercel/workflow-core';
import { add } from './steps.ts';

export async function example(i: number) {
  'use workflow';
  const a = await add(i, 7);
  const b = await add(a, 8);
  await sleep('1 minute');
  const c = await add(b, 9);
  return c;
}
