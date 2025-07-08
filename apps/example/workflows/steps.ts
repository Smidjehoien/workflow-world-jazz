import { FatalError } from '@vercel/workflow-core';

export async function add(a: number, b: number): Promise<number> {
  'use step';

  // Mimic a retryable error 50% of the time
  if (Math.random() < 0.5) {
    throw new Error('Retryable error');
  }

  // Mimic a 5% chance of the workflow actually failing
  if (Math.random() < 0.05) {
    throw new FatalError("We're cooked yo!");
  }

  return a + b;
}
