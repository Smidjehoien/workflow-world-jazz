import type { ChatTransport, UIMessageChunk } from 'ai';
import type { MyUIMessage } from './chat-schema';
import * as ndjson from './ndjson';
import { iteratorToStream, streamToIterator } from './stream-iterator';

function onFinish() {
  localStorage.removeItem('active-workflow-run-id');
}

export const transport: ChatTransport<MyUIMessage> = {
  async sendMessages({ chatId, messages, abortSignal }) {
    const self = this;

    async function* stream(): AsyncGenerator<UIMessageChunk> {
      // We keep track of if the "finish" chunk is received to determine
      // if we need to reconnect, and keep track of the chunk index to resume from.
      let gotFinish = false;
      let chunkIndex = 0;

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      if (!res.ok || !res.body) {
        throw new Error(
          `Failed to fetch chat: ${res.status} ${await res.text()}`
        );
      }

      // Update the chat history in `localStorage` to include the latest user message
      localStorage.setItem('chat-history', JSON.stringify(messages));

      const workflowRunId = res.headers.get('x-active-workflow-run-id');
      if (workflowRunId) {
        localStorage.setItem('active-workflow-run-id', workflowRunId);
      }

      // Flush the initial stream until the end or an error occurs.
      try {
        for await (const chunk of streamToIterator(
          res.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(ndjson.parse<UIMessageChunk>())
        )) {
          chunkIndex++;

          yield chunk;

          if (chunk.type === 'finish') {
            gotFinish = true;
          }
        }
      } catch (error) {
        console.error('Error in chat POST stream', error);
      }

      if (gotFinish) {
        onFinish();
      } else {
        // If the initial POST request did not include the "finish" chunk,
        // we need to reconnect to the stream. This could indicate that a
        // network error occurred or the Vercel Function timed out.
        const resumeStream = await self.reconnectToStream({
          chatId,
          metadata: { chunkIndex },
        });
        if (!resumeStream) {
          throw new Error('Failed to reconnect to chat stream');
        }
        yield* streamToIterator(resumeStream);
      }
    }

    return iteratorToStream(stream, { signal: abortSignal });
  },

  async reconnectToStream(options) {
    const workflowRunId = localStorage.getItem('active-workflow-run-id');
    if (!workflowRunId) {
      return null;
    }

    const path = `/api/chat/${encodeURIComponent(workflowRunId)}/stream`;

    // Start from the beginning of the current chat message
    // (i.e. during page reload / new tab)
    let chunkIndex = 0;

    // If the metadata object has a `chunkIndex` property provided from
    // the `sendMessages` method above then resume from that chunk index
    if (
      options.metadata &&
      typeof options.metadata === 'object' &&
      'chunkIndex' in options.metadata &&
      typeof options.metadata.chunkIndex === 'number'
    ) {
      chunkIndex = options.metadata.chunkIndex;
    }

    async function* stream(): AsyncGenerator<UIMessageChunk> {
      let gotFinish = false;
      while (!gotFinish) {
        const res = await fetch(`${path}?startIndex=${chunkIndex}`);

        if (!res.ok || !res.body) {
          throw new Error(
            `Failed to fetch chat: ${res.status} ${await res.text()}`
          );
        }

        try {
          for await (const chunk of streamToIterator(
            res.body
              .pipeThrough(new TextDecoderStream())
              .pipeThrough(ndjson.parse<UIMessageChunk>())
          )) {
            chunkIndex++;

            yield chunk;

            if (chunk.type === 'finish') {
              gotFinish = true;
            }
          }
        } catch (error) {
          console.error('Error in chat GET reconnectToStream', error);
        }
      }

      onFinish();
    }

    return iteratorToStream(stream);
  },
};
