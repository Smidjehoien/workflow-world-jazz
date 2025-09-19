import type { Streamer } from '../world/interfaces.js';
import type { APIConfig } from './utils.js';
import { DEFAULT_CONFIG } from './utils.js';

export function createStreamer(config?: APIConfig): Streamer {
  const getStreamUrl = (name: string) =>
    new URL(
      `/api/stream/${encodeURIComponent(name)}`,
      config?.baseUrl ?? DEFAULT_CONFIG.baseUrl
    );

  return {
    async writeToStream(name: string, chunk: string | Uint8Array | Buffer) {
      await fetch(getStreamUrl(name), {
        method: 'PUT',
        body: chunk,
        duplex: 'half',
      });
    },

    async closeStream(name: string) {
      await fetch(getStreamUrl(name), {
        method: 'PUT',
        headers: {
          'X-Stream-Done': 'true',
        },
      });
    },

    async readFromStream(name: string, startIndex?: number) {
      const url = getStreamUrl(name);
      if (typeof startIndex === 'number') {
        url.searchParams.set('startIndex', String(startIndex));
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch stream: ${res.status}`);
      return res.body as ReadableStream<Uint8Array>;
    },
  };
}
