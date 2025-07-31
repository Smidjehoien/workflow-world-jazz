import type { World } from '../world.js';
import { createEmbedded } from './embedded.js';
import { createVqs } from './vqs.js';

export const world: World =
  process.env.WORKFLOWS_USE_EMBEDDED_WORLD === '1'
    ? createEmbedded()
    : createVqs();
