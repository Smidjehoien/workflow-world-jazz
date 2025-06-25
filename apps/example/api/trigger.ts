/**
 * This is a simple trigger for the "example" workflow.
 *
 * The `start()` function can be invoked from anywhere.
 *
 * But when a Vercel Function, like here, or from a Next.js server action,
 * then the `baseUrl` option is inferred based on the `VERCEL_URL` environment
 * variable.
 *
 * If running in a script where that is not defined, then the `baseUrl` option
 * must be provided.
 */
import { start } from '@vercel/workflow-core';

export const POST = async () => {
  const workflowId = 'example';
  const runId = await start(workflowId, {
    arguments: [42],
  });
  return new Response(
    `Starting "${workflowId}" workflow with run ID "${runId}"`
  );
};
