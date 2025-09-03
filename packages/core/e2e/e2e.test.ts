import { describe, expect, test } from 'vitest';
import { dehydrateWorkflowArguments } from '../src/serialization';

const deploymentUrl = process.env.DEPLOYMENT_URL;
if (!deploymentUrl) {
  throw new Error('`DEPLOYMENT_URL` environment variable is not set');
}

async function triggerWorkflow(
  workflow: string,
  args: any[]
): Promise<{ runId: string }> {
  const url = new URL('/api/trigger', deploymentUrl);
  url.searchParams.set('workflow', workflow);
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(dehydrateWorkflowArguments(args, [], globalThis)),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to trigger workflow: ${res.url} ${res.status}: ${await res.text()}`
    );
  }
  const run = await res.json();
  return run;
}

async function getWorkflowReturnValue(runId: string) {
  // We need to poll the GET endpoint until the workflow run is completed.
  // TODO: make this more efficient when we add subscription support.
  while (true) {
    const url = new URL('/api/trigger', deploymentUrl);
    url.searchParams.set('runId', runId);

    const res = await fetch(url);

    if (res.status === 202) {
      // Workflow run is still running, so we need to wait and poll again
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    const contentType = res.headers.get('Content-Type');

    if (contentType?.includes('application/json')) {
      return await res.json();
    }

    if (contentType?.includes('application/octet-stream')) {
      return res.body;
    }

    throw new Error(`Unexpected content type: ${contentType}`);
  }
}

describe('e2e', () => {
  test('addTenWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('addTenWorkflow', [123]);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBe(133);
  });

  test('promiseAllWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('promiseAllWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBe('ABC');
  });

  test('promiseRaceWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('promiseRaceWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBe('B');
  });

  test('promiseAnyWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('promiseAnyWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBe('B');
  });

  test('readableStreamWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('readableStreamWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBeInstanceOf(ReadableStream);

    const decoder = new TextDecoder();
    let contents = '';
    for await (const chunk of returnValue) {
      const text = decoder.decode(chunk, { stream: true });
      contents += text;
    }
    expect(contents).toBe('0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n');
  });

  // TODO @TooTallNate: currently flaky because of a race condition
  test.skip('namedWebhookWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('namedWebhookWorkflow', []);

    // Wait a few seconds so that the webhook is registered.
    // TODO: make this more efficient when we add subscription support.
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    // Send a GET request to the webhook.
    const webhookUrl = new URL('/api/e2e/webhook', deploymentUrl);
    const getRes = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'x-workflow-e2e-custom-header': '1',
      },
    });
    expect(getRes.status).toBe(200);

    // Send a POST request to the webhook.
    const postRes = await fetch(webhookUrl, {
      method: 'POST',
      body: 'Hello, world from POST!',
      headers: {
        'x-workflow-e2e-custom-header': '2',
      },
    });
    expect(postRes.status).toBe(200);

    // Send a DELETE request to the webhook.
    const deleteRes = await fetch(webhookUrl, {
      method: 'DELETE',
      body: 'Hello, world from DELETE!',
      headers: {
        'x-workflow-e2e-custom-header': '3',
      },
    });
    expect(deleteRes.status).toBe(200);

    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBeInstanceOf(Array);
    expect(returnValue.length).toBe(3);
    expect(returnValue[0].method).toBe('GET');
    expect(returnValue[0].body).toBe('');
    expect(returnValue[0].headers['x-workflow-e2e-custom-header']).toBe('1');
    expect(returnValue[1].method).toBe('POST');
    expect(returnValue[1].body).toBe('Hello, world from POST!');
    expect(returnValue[1].headers['x-workflow-e2e-custom-header']).toBe('2');
    expect(returnValue[2].method).toBe('DELETE');
    expect(returnValue[2].body).toBe('Hello, world from DELETE!');
    expect(returnValue[2].headers['x-workflow-e2e-custom-header']).toBe('3');
  });

  test('sleepingWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('sleepingWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue.startTime).toBeLessThan(returnValue.endTime);
    expect(returnValue.endTime - returnValue.startTime).toBeGreaterThan(9999);
  });
});
