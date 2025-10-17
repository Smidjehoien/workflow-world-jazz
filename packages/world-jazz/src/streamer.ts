import type { Streamer } from '@vercel/workflow-world';
import { co, type FileStream } from 'jazz-tools';
import { type JazzStorageAccountResolver, JazzStream } from './types.js';

export const createStreamer = (
  ensureLoaded: JazzStorageAccountResolver
): Streamer => {
  // TODO: Remove this cache once loadUnique is safe for concurrent use.
  const streamCache = new Map<string, Promise<FileStream>>();
  const loadOrCreateStream = async (name: string): Promise<FileStream> => {
    let streamPromise = streamCache.get(name);
    if (streamPromise) {
      return streamPromise;
    }
    streamPromise = loadOrCreateStreamRaw(name);
    streamCache.set(name, streamPromise);
    return streamPromise;
  };

  const loadOrCreateStreamRaw = async (name: string): Promise<FileStream> => {
    const root = (await ensureLoaded({ root: true })).root;

    const unique = `stream/${name}`;
    let js = await JazzStream.loadUnique(unique, root.$jazz.owner.$jazz.id);
    if (!js) {
      const stream = co.fileStream().create();
      stream.start({ mimeType: 'application/octet-stream' });
      js = JazzStream.create(
        { name, stream },
        { unique, owner: root.$jazz.owner }
      );
    }

    const stream = (await js.$jazz.ensureLoaded({ resolve: { stream: true } }))
      .stream;
    return stream;
  };

  return {
    async writeToStream(name: string, chunk: string | Uint8Array | Buffer) {
      const stream = await loadOrCreateStream(name);

      // Convert chunk to Uint8Array if needed
      let chunkData: Uint8Array;
      if (typeof chunk === 'string') {
        chunkData = new TextEncoder().encode(chunk);
      } else if (chunk instanceof Buffer) {
        chunkData = new Uint8Array(chunk);
      } else {
        chunkData = chunk;
      }

      stream.push(chunkData);
    },

    async closeStream(name: string) {
      const stream = await loadOrCreateStream(name);
      stream.end();
    },

    async readFromStream(
      name: string,
      startIndex = 0
    ): Promise<ReadableStream<Uint8Array>> {
      const stream = await loadOrCreateStream(name);

      let unsubscribe: () => void;
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          let lastIndex = startIndex;

          unsubscribe = stream.$jazz.subscribe((fileStream: FileStream) => {
            const chunks = fileStream.getChunks({ allowUnfinished: true });
            if (chunks) {
              for (let i = lastIndex; i < chunks.chunks.length; i++) {
                controller.enqueue(chunks.chunks[i]);
              }
              lastIndex = chunks.chunks.length;
            }

            if (fileStream.isBinaryStreamEnded()) {
              controller.close();
              unsubscribe();
            }
          });
        },
        cancel() {
          unsubscribe();
        },
      });
    },
  };
};
