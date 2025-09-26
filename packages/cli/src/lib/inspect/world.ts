import { access } from 'node:fs/promises';
import {
  createEmbeddedWorld,
  createVercelWorld,
} from '@vercel/workflow-core/runtime';
import { logDebug, logError, logWarn } from '../config/log.js';
import { getWorkflowConfig } from '../config/workflow-config.js';
import { getAuth } from './auth.js';
import {
  getProjectLink,
  isOneOfErrNoExceptions,
  type ProjectLink,
} from './vercel-link.js';

export const inferWorkflowDataDir = async () => {
  const envConfig = process.env.WORKFLOW_EMBEDDED_WORLD_CONFIG;
  let config: { dataDir: string };
  if (envConfig) {
    try {
      config = JSON.parse(envConfig);
    } catch (error) {
      logError('Invalid JSON in WORKFLOW_EMBEDDED_WORLD_CONFIG');
      throw error;
    }
    // Confirm the data dir is accessible
    await access(config.dataDir);
    logDebug(
      'Using workflow data directory from WORKFLOW_EMBEDDED_WORLD_CONFIG:',
      config.dataDir
    );
    return config.dataDir;
  }
  // Paths to check, in order of preference
  const paths = ['.next/workflow-data', '.workflow-data', 'workflow-data'];
  // TODO: Find these relative to repository root, using findRepoRoot?
  // Unclear, since the workflow data dir might be in a sub-project
  for (const path of paths) {
    if (
      await access(path)
        .then(() => true)
        .catch(() => false)
    ) {
      logDebug('Found workflow data directory:', path);
      return path;
    }
  }
  logError('No workflow data directory found. Have you run any workflows yet?');
  logWarn(`\nCheck whether your data is in any of:\n${paths.join('\n')}\n\n`);
  throw new Error('No workflow data directory found');
};

export const inferVercelProjectAndTeam = async () => {
  const cwd = getWorkflowConfig().workingDir;
  let project: ProjectLink | null = null;
  try {
    project = await getProjectLink(cwd);
  } catch (error) {
    if (!isOneOfErrNoExceptions(error, ['ENOENT'])) {
      throw error;
    }
  }
  if (!project) {
    logDebug('Could not find project link folder');
    return;
  }
  logDebug(`Found project ${project.projectId} and team ${project.orgId}`);
  return {
    projectId: project.projectId,
    teamId: project.orgId,
  };
};

export const inferVercelConfig = async ({
  env,
  authToken,
  projectId,
  teamId,
  hostUrl,
}: {
  env: 'production' | 'preview';
  authToken?: string;
  projectId?: string;
  teamId?: string;
  hostUrl?: string;
}) => {
  const headers: Record<string, string> = {
    'x-vercel-environment': env,
  };
  if (hostUrl) {
    logDebug('Using vercel backend URL from CLI argument or ENV');
  }
  const ret = {
    token: authToken,
    baseUrl: hostUrl || 'https://api.vercel.com',
    headers,
  };
  if (projectId && teamId) {
    logDebug('Using vercel project and team from CLI argument or ENV');
    headers['x-vercel-project-id'] = projectId;
    headers['x-vercel-team'] = teamId;
  } else {
    logDebug('Inferring vercel project and team from .vercel folder');
    const inferredProject = await inferVercelProjectAndTeam();
    if (inferredProject) {
      const { projectId: inferredProjectId, teamId: inferredTeamId } =
        inferredProject;
      ret.headers['x-vercel-project-id'] = inferredProjectId;
      ret.headers['x-vercel-team'] = inferredTeamId;
    } else {
      logWarn(
        'Could not infer vercel project and team from .vercel folder, server authentication might fail.'
      );
    }
  }
  if (authToken) {
    logDebug('Using vercel auth token from CLI argument or ENV');
    return ret;
  }
  const auth = getAuth();
  if (!auth) {
    throw new Error('Could not find credentials. Run `vc login` to log in.');
  }
  logDebug('Using vercel auth token from CLI auth file');
  ret.token = auth.token;
  return ret;
};

export const getWorld = async ({
  world,
  env,
  authToken,
  projectId,
  teamId,
  hostUrl,
}: {
  world: 'embedded' | 'vercel';
  env: 'production' | 'preview';
  authToken?: string;
  projectId?: string;
  teamId?: string;
  hostUrl?: string;
}) => {
  const dataDir =
    world === 'embedded' ? await inferWorkflowDataDir() : undefined;
  if (world === 'embedded') {
    logDebug('Using embedded backend with dir:', dataDir);
    const world = createEmbeddedWorld(dataDir, true);
    return world;
  } else if (world === 'vercel') {
    const config = await inferVercelConfig({
      env,
      authToken,
      projectId,
      teamId,
      hostUrl,
    });
    const world = createVercelWorld(config);
    return world;
  }
  throw new Error('Invalid world type');
};
