import { useContext } from '@vercel/workflow-core';

async function stepUsingContext() {
  'use step';
  const ctx = useContext();
  console.log('step context', ctx);

  // Mimic a retryable error 50% of the time (so that the `attempt` counter increases)
  if (Math.random() < 0.5) {
    throw new Error('Retryable error');
  }
}

export async function workflowUsingContext() {
  'use workflow';
  const ctx = useContext();
  console.log('workflow context', ctx);

  await stepUsingContext();
}
