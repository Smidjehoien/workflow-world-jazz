import { getWorkflowReadableStream } from '@vercel/workflow-core/runtime';
import {
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { chat } from '@/workflows/chat';

// TODO: remove these once example app is updated to import
// workflows with start()
import '../../../../example/workflows/99_e2e';

// Uncomment to simulate a long running Vercel Function timing
// out due to a long running agent. The client-side will
// automatically reconnect to the stream.
//export const maxDuration = 8;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const workflowHandle = await chat(messages);

  // TODO: To avoid the cast, use the `start()` function instead of
  // calling the `chat()` function directly?
  const workflowRunId = (workflowHandle as any).runId;

  return createUIMessageStreamResponse({
    stream: getWorkflowReadableStream<UIMessageChunk>(workflowRunId),
    headers: {
      // The workflow run ID is stored into `localStorage` on the client side,
      // which influences the `resume` flag in the `useChat` hook.
      'x-workflow-run-id': workflowRunId,
    },
  });
}
