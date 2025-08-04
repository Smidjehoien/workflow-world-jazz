import { test } from 'vitest';
import { dehydrateWorkflowArguments } from '../src/serialization';

const deploymentUrl = process.env.DEPLOYMENT_URL;
if (!deploymentUrl) {
  throw new Error('`DEPLOYMENT_URL` environment variable is not set');
}

async function triggerWorkflow(workflow: string, args: any[]) {
  const url = new URL('/api/trigger', deploymentUrl);
  url.searchParams.set('workflow', workflow);
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(dehydrateWorkflowArguments(args, [], globalThis)),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to trigger workflow: ${res.statusText}: ${await res.text()}`
    );
  }
  const run = await res.json();
  return run;
}

test('1_simple', async () => {
  const run = await triggerWorkflow('simple', [123]);
  console.log(run);
  // TODO: Check that the run is complete, verify the result
  //expect(run.status).toBe(200);
});
