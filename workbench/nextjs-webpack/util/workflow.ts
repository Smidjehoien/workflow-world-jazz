import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

export async function createAIWorkflowResponse(messages: UIMessage[]) {
  const { writable, readable } = new TransformStream<
    UIMessageChunk,
    UIMessageChunk
  >();

  const uiMessageStream = await createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({
        type: 'start',
        messageMetadata: {
          createdAt: Date.now(),
        },
      });
      writer.write({
        type: 'data-workflow',
        data: { message: 'Chat API route triggered' },
      });
      writer.merge(readable);
    },
    originalMessages: messages,
  });

  return {
    response: createUIMessageStreamResponse({
      status: 200,
      statusText: 'OK',
      stream: uiMessageStream,
    }),
    writable,
  };
}
