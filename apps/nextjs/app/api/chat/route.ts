import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { chat } from '@/workflows/chat';

// So the response stream doesn't timeout
export const maxDuration = 800;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const { writable, readable } = new TransformStream<
    UIMessageChunk,
    UIMessageChunk
  >();
  const uiMessageStream = await createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(readable);
    },
    originalMessages: messages,
  });

  const result = await chat(messages, writable);
  console.log('Started workflow', result);

  return createUIMessageStreamResponse({
    status: 200,
    statusText: 'OK',
    stream: uiMessageStream,
  });
}
