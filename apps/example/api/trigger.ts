import { getWorkflowReturnValue, start } from '@vercel/workflow-core/runtime';
import { hydrateWorkflowArguments } from '@vercel/workflow-core/serialization';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const workflow = url.searchParams.get('workflow') || 'simple';

  let args: any[] = [];

  // Args from query string
  const argsParam = url.searchParams.get('args');
  if (argsParam) {
    args = argsParam.split(',').map((arg) => {
      const num = parseFloat(arg);
      return Number.isNaN(num) ? arg.trim() : num;
    });
  } else {
    // Args from body
    const body = await req.text();
    if (body) {
      args = hydrateWorkflowArguments(JSON.parse(body), globalThis);
    } else {
      args = [42];
    }
  }
  console.log(`Starting "${workflow}" workflow with args: ${args}`);

  const run = await start(workflow, args);
  console.log('Run:', run);

  return Response.json(run);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');
  if (!runId) {
    return new Response('No runId provided', { status: 400 });
  }
  try {
    const returnValue = await getWorkflowReturnValue(runId);
    console.log('Return value:', returnValue);
    return returnValue instanceof ReadableStream
      ? new Response(returnValue, {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        })
      : Response.json(returnValue);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'WorkflowRunNotCompletedError') {
        return Response.json(
          {
            ...error,
            name: error.name,
            message: error.message,
          },
          { status: 202 }
        );
      }

      if (error.name === 'WorkflowRunFailedError') {
        return Response.json(
          {
            ...error,
            name: error.name,
            message: error.message,
          },
          { status: 400 }
        );
      }
    }

    console.error(
      'Unexpected error while getting workflow return value:',
      error
    );
    return Response.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
