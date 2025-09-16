import { assert, describe, expect, test } from 'vitest';
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

describe.concurrent('e2e', () => {
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

  test('nullByteWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('nullByteWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toBe('null byte \0');
  });

  test('getContextWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('getContextWorkflow', []);
    const returnValue = await getWorkflowReturnValue(run.runId);

    expect(returnValue).toHaveProperty('workflowCtx');
    expect(returnValue).toHaveProperty('stepCtx');

    // workflow and context

    // Both contexts should have the same runId
    expect(returnValue.workflowCtx.workflowRunId).toBe(run.runId);
    expect(returnValue.stepCtx.workflowRunId).toBe(run.runId);

    // Both contexts should have matching workflowStartedAt timestamp
    expect(typeof returnValue.workflowCtx.workflowStartedAt).toBe('string');
    expect(typeof returnValue.stepCtx.workflowStartedAt).toBe('string');
    expect(returnValue.workflowCtx.workflowStartedAt).toBe(
      returnValue.stepCtx.workflowStartedAt
    );

    // Both contexts should have matching url
    expect(typeof returnValue.workflowCtx.url).toBe('string');
    expect(typeof returnValue.stepCtx.url).toBe('string');
    expect(returnValue.workflowCtx.url).toBe(returnValue.stepCtx.url);

    // step context

    // Attempt should be atleast 1
    expect(returnValue.stepCtx.attempt).toBeGreaterThanOrEqual(1);

    // stepStartedAt should be a Date
    expect(typeof returnValue.stepCtx.stepStartedAt).toBe('string');
  });

  test('outputStreamWorkflow', { timeout: 60_000 }, async () => {
    const run = await triggerWorkflow('outputStreamWorkflow', []);
    const stream = await fetch(
      `${deploymentUrl}/api/trigger?runId=${run.runId}&output-stream=1`
    );
    const textDecoderStream = new TextDecoderStream();
    stream.body?.pipeThrough(textDecoderStream);
    const reader = textDecoderStream.readable.getReader();

    const r1 = await reader.read();
    assert(r1.value);
    const chunk1 = JSON.parse(r1.value);
    const binaryData = Buffer.from(chunk1.data, 'base64');
    expect(binaryData.toString()).toEqual('Hello, world!');

    const r2 = await reader.read();
    assert(r2.value);
    const chunk2 = JSON.parse(r2.value);
    expect(chunk2).toEqual({ foo: 'test' });

    const r3 = await reader.read();
    expect(r3.done).toBe(true);

    const returnValue = await getWorkflowReturnValue(run.runId);
    expect(returnValue).toEqual('done');
  });
});
