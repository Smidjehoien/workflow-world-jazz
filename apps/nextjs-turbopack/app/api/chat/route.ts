import { getWorkflowOutputStream } from '@vercel/workflow-core/runtime';
import { createUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';
import * as ndjson from '@/util/ndjson';
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

  const readable = getWorkflowOutputStream<UIMessageChunk>(workflowRunId);

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(readable);
    },
    originalMessages: messages,
  });

  const response = new Response(
    uiMessageStream
      .pipeThrough(ndjson.stringify())
      .pipeThrough(new TextEncoderStream()),
    {
      headers: {
        'Content-Type': 'application/x-ndjson',

        // The workflow run ID is stored into `localStorage` on the client side,
        // which influences the `resume` flag in the `useChat` hook.
        'x-active-workflow-run-id': workflowRunId,
      },
    }
  );

  return response;
}
