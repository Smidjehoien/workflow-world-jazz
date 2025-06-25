import { handleWorkflow } from 'workflow';

export const POST = handleWorkflow(
  `async function wflow(i: number) {
  const a = await add(i, 7);
  const b = await add(a, 8);
  return b;
}`,
  'wflow'
);
