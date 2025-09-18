import type { Streamer } from '../world/interfaces.js';
import type { APIConfig } from './utils.js';
import { DEFAULT_CONFIG } from './utils.js';

export function createStreamer(config?: APIConfig): Streamer {
  return {
    async writeToStream(name: string, chunk: string | Uint8Array | Buffer) {
      await fetch(
        `${config?.baseUrl ?? DEFAULT_CONFIG.baseUrl}/api/stream/${name}`,
        {
          method: 'PUT',
          body: chunk,
          duplex: 'half',
        }
      );
    },

    async closeStream(name: string) {
      await fetch(
        `${config?.baseUrl ?? DEFAULT_CONFIG.baseUrl}/api/stream/${name}`,
        {
          method: 'PUT',
          headers: {
            'X-Stream-Done': 'true',
          },
        }
      );
    },

    async readFromStream(name: string) {
      const res = await fetch(
        `${config?.baseUrl ?? DEFAULT_CONFIG.baseUrl}/api/stream/${name}`
      );
      if (!res.ok) throw new Error(`Failed to fetch stream: ${res.status}`);
      return res.body as ReadableStream<Uint8Array>;
    },
  };
}
