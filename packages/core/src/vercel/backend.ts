import type { WorkflowBackend } from '../world/interfaces.js';
import type { APIConfig } from './utils.js';
import { createStorage } from './storage.js';
import { createStreamer } from './streamer.js';

export function createVercel(config?: APIConfig): WorkflowBackend {
  const storage = createStorage(config);
  const streamer = createStreamer(config);

  return {
    // Streamer interface
    writeToStream: streamer.writeToStream,
    closeStream: streamer.closeStream,
    readFromStream: streamer.readFromStream,

    // AuthProvider interface
    getAuthInfo: storage.getAuthInfo,
    checkHealth: storage.checkHealth,

    // Storage interface with namespaced methods
    runs: storage.runs,
    steps: storage.steps,
    events: storage.events,
    webhooks: storage.webhooks,
  };
}
