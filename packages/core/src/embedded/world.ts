import { instrumentObject } from '../telemetry.js';
import type { World } from '../world/interfaces.js';
import { auth } from './auth.js';
import { config } from './config.js';
import { createQueue } from './queue.js';
import { createStorage } from './storage.js';
import { createStreamer } from './streamer.js';

/**
 * Creates an embedded world instance that combines queue, storage, streamer, and authentication functionalities.
 */
export function createEmbeddedWorld(): World {
  return {
    ...createQueue(),
    ...instrumentObject('EmbeddedBackend', {
      ...createStorage(config.value.dataDir),
      ...createStreamer(config.value.dataDir),
      ...auth,
    }),
  };
}
