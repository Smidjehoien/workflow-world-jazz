import { localAdd, stepAdd } from './math';

export async function example(i: number) {
  'use workflow';
  const a = await localAdd(i, 7);
  const b = await stepAdd(a, 8);
  return b;
}
