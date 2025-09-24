import { access } from 'node:fs/promises';
import {
  createEmbeddedWorld,
  createVercelWorld,
} from '@vercel/workflow-core/runtime';
import chalk from 'chalk';

export const inferWorkflowDataDir = async () => {
  const envConfig = process.env.WORKFLOW_EMBEDDED_WORLD_CONFIG;
  let config: { dataDir: string };
  if (envConfig) {
    try {
      config = JSON.parse(envConfig);
    } catch (error) {
      console.error(
        chalk.red(
          '[Error] Invalid JSON in WORKFLOW_EMBEDDED_WORLD_CONFIG:',
          error
        )
      );
      throw error;
    }
    // Confirm the data dir is accessible
    await access(config.dataDir);
    console.log(
      chalk.gray(
        '[Debug] Using workflow data directory from WORKFLOW_EMBEDDED_WORLD_CONFIG:',
        config.dataDir
      )
    );
    return config.dataDir;
  }
  // Paths to check, in order of preference
  const paths = ['.next/workflow-data', '.workflow-data', 'workflow-data'];
  for (const path of paths) {
    if (
      await access(path)
        .then(() => true)
        .catch(() => false)
    ) {
      console.log(chalk.gray('[Debug] Found workflow data directory:', path));
      return path;
    }
  }
  console.error(
    chalk.red(
      '[Error] No workflow data directory found. Have you run any workflows yet?\n'
    )
  );
  console.warn(
    chalk.yellow(
      `Check whether your data is in any of:\n${paths.join('\n')}\n\n`
    )
  );
  throw new Error('No workflow data directory found');
};

export const inferVercelConfig = async (env: 'production' | 'preview') => {
  console.log('Inferring vercel config for', env);
  if (process.env.VERCEL_DEPLOYMENT_ID) {
    // TODO
  }
  throw new Error('Vercel backend not supported yet');
};

// TODO: Provide a cached promise version of this
export const getWorld = async (
  world: 'embedded' | 'vercel' = 'embedded',
  env: 'production' | 'preview' = 'production'
) => {
  const dataDir =
    world === 'embedded' ? await inferWorkflowDataDir() : undefined;
  if (world === 'embedded') {
    console.log(
      chalk.gray('[Debug] Creating embedded world with data dir', dataDir)
    );
    const world = createEmbeddedWorld(dataDir, true);
    console.log('\n');
    return world;
  } else if (world === 'vercel') {
    console.log(chalk.gray('[Debug] Creating vercel world with config', env));
    const config = await inferVercelConfig(env);
    const world = createVercelWorld(config);
    console.log('\n');
    return world;
  }
  throw new Error('Invalid world type');
};
