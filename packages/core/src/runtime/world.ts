import type { World } from '@vercel/workflow-world';
import { createEmbeddedWorld } from '@vercel/workflow-world-embedded';
import { createVercelWorld } from '@vercel/workflow-world-vercel';
import { shouldUseEmbeddedWorld } from '../env.js';

export const world: World = shouldUseEmbeddedWorld()
  ? createEmbeddedWorld()
  : createVercelWorld();
