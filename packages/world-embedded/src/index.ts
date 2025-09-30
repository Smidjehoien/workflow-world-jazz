import type { World } from '@vercel/workflow-world';
import { auth } from './auth.js';
import { config } from './config.js';
import { createQueue } from './queue.js';
import { createStorage } from './storage.js';
import { createStreamer } from './streamer.js';

const stub = (name: string) => () => {
  throw new Error(`${name} is disabled in read only mode`);
};

/**
 * Creates an embedded world instance that combines queue, storage, streamer, and authentication functionalities.
 *
 * @param dataDir - The directory to use for storage. If not provided, the default data dir will be used.
 * @param readOnly - If the world is read only, no workflows can be created or updated, but data can still be read.
 * NOTE: This is temporarily used to skip the queue when using the CLI with the embedded world, but will be un-done
 * when the CLI gets write capabilities, at which point we'll likely improve our PORT inference / options parsing.
 */
export function createEmbeddedWorld(
  dataDir?: string,
  readOnly?: boolean
): World {
  const dir = dataDir ?? config.value.dataDir;
  if (readOnly) {
    console.warn(
      '\x1b[90m[Debug] Using embedded backend in read only mode. Queue is disabled.\x1b[0m'
    );
  }
  const queue = readOnly
    ? {
        queue: stub('Queue'),
        createQueueHandler: stub('QueueHandler'),
        getDeploymentId: stub('DeploymentId'),
      }
    : createQueue();

  return {
    ...queue,
    ...createStorage(dir),
    ...createStreamer(dir),
    ...auth,
  };
}
