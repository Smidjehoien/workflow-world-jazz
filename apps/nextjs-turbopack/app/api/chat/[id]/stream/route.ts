import { getWorkflowOutputStream } from '@vercel/workflow-core/runtime';
import { createUIMessageStream, type UIMessageChunk } from 'ai';
import * as ndjson from '@/util/ndjson';

// Uncomment to simulate a long running Vercel Function timing
// out due to a long running agent. The client-side will
// automatically reconnect to the stream.
//export const maxDuration = 5;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get('startIndex');
  const startIndex =
    startIndexParam !== null ? parseInt(startIndexParam, 10) : undefined;

  const readable = getWorkflowOutputStream<UIMessageChunk>(id, { startIndex });

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(readable);
    },
  });

  return new Response(
    uiMessageStream
      .pipeThrough(ndjson.stringify())
      .pipeThrough(new TextEncoderStream()),
    {
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
    }
  );
}
