import type { World } from '@vercel/workflow-world';
import { createEmbeddedWorld } from '@vercel/workflow-world-embedded';
import {
  type APIConfig,
  createVercelWorld,
} from '@vercel/workflow-world-vercel';

let worldCache: World | undefined;
let stubbedWorldCache: World | undefined;

const initWorld = () => {
  const targetWorld = process.env.WORKFLOW_TARGET_WORLD || 'vercel';

  if (targetWorld === 'vercel') {
    const headers: Record<string, string> = {};
    const config: APIConfig = { headers };
    const env = process.env.WORKFLOW_VERCEL_ENV;
    const authToken = process.env.WORKFLOW_VERCEL_AUTH_TOKEN;
    const projectId = process.env.WORKFLOW_VERCEL_PROJECT_ID;
    const teamId = process.env.WORKFLOW_VERCEL_TEAM_ID;
    const proxyUrl = process.env.WORKFLOW_VERCEL_PROXY_URL;
    if (authToken) {
      config.token = authToken;
    }
    if (env) {
      headers['x-vercel-environment'] = env;
    }
    if (projectId) {
      headers['x-vercel-project-id'] = projectId;
    }
    if (teamId) {
      headers['x-vercel-team-id'] = teamId;
    }
    if (proxyUrl) {
      config.baseUrl = proxyUrl;
    }
    return createVercelWorld(config);
  }

  if (targetWorld !== 'embedded') {
    console.error(
      `Invalid target world: ${targetWorld}, using embedded world instead.`
    );
  }

  const dataDir = process.env.WORKFLOW_EMBEDDED_DATA_DIR;
  const port = process.env.PORT ? Number(process.env.PORT) : undefined;
  return createEmbeddedWorld(dataDir, port);
};

/**
 * Some functions from the world are needed at build time, but we do NOT want
 * to cache the world in those instances for general use, since we don't have
 * the correct environment variables set yet. This is a safe function to
 * call at build time, that only gives access to non-environment-bound world
 * functions. The only binding value should be the target world.
 * Once we migrate to a file-based configuration (workflow.config.ts), we should
 * be able to re-combine getWorld and getWorldHandlers into one singleton.
 */
export const getWorldHandlers = (): Pick<World, 'createQueueHandler'> => {
  if (stubbedWorldCache) {
    return stubbedWorldCache;
  }
  const _world = initWorld();
  stubbedWorldCache = _world;
  return {
    createQueueHandler: _world.createQueueHandler,
  };
};

export const getWorld = (): World => {
  if (worldCache) {
    return worldCache;
  }
  worldCache = initWorld();
  return worldCache;
};

/**
 * Reset the cached world instance. This should be called when environment
 * variables change and you need to reinitialize the world with new config.
 */
export const resetWorld = (): void => {
  worldCache = undefined;
  stubbedWorldCache = undefined;
};
