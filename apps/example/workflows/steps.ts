import { FatalError } from '@vercel/workflow-core';

export async function add(a: number, b: number): Promise<number> {
  'use step';

  if (Math.random() < 0.5) {
    throw new Error('Retryable error');
  }
  if (Math.random() < 0.2) {
    throw new FatalError("We're cooked yo!");
  }
  return a + b;
}
