//import { add } from './steps.ts';
import { useStep } from '@vercel/workflow-core/dist/step';

const add = useStep('add');

export async function workflow(i: number) {
  'use workflow';
  const a = await add(i, 7);
  const b = await add(a, 8);
  return b;
}
