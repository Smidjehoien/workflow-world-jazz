import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import open from 'open';
import { logger } from '../config/log.js';

const WEB_PORT = 3456;
const WEB_PACKAGE_NAME = '@vercel/workflow-web';

let serverProcess: ChildProcess | null = null;
let serverStarting = false;

/**
 * Check if the web package is installed and accessible
 */
function isWebPackageInstalled(): boolean {
  try {
    // In development (local workspace), check if the package exists as a sibling
    const currentDir = fileURLToPath(new URL('.', import.meta.url));
    const webPackagePath = join(currentDir, '../../../../web');

    if (existsSync(webPackagePath)) {
      logger.debug(`Found web package at: ${webPackagePath}`);
      return true;
    }

    // Try to resolve as an installed package
    require.resolve(WEB_PACKAGE_NAME);
    logger.debug(`Found web package: ${WEB_PACKAGE_NAME}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to the web package
 */
function getWebPackagePath(): string | null {
  try {
    // In development (local workspace), use the sibling package
    const currentDir = fileURLToPath(new URL('.', import.meta.url));
    const webPackagePath = join(currentDir, '../../../../web');

    if (existsSync(webPackagePath)) {
      return webPackagePath;
    }

    // Try to resolve as an installed package
    const resolvedPath = require.resolve(WEB_PACKAGE_NAME);
    return join(resolvedPath, '../..');
  } catch {
    return null;
  }
}

/**
 * Check if server is already running on the port
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${WEB_PORT}`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the web server
 */
async function startWebServer(): Promise<boolean> {
  if (serverStarting) {
    logger.debug('Server is already starting...');
    return true;
  }

  if (await isServerRunning()) {
    logger.debug('Server is already running');
    return true;
  }

  const webPath = getWebPackagePath();
  if (!webPath) {
    logger.error('Web package path not found');
    return false;
  }
  logger.debug(`Web package path: ${webPath}`);

  serverStarting = true;

  try {
    logger.info('Starting web UI server...');

    // Start the Next.js server
    serverProcess = spawn('npx', ['next', 'start', '-p', String(WEB_PORT)], {
      cwd: webPath,
      detached: true,
      stdio: 'pipe',
    });

    // Wait for server to be ready
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (await isServerRunning()) {
        logger.success(
          chalk.green(`Web UI server started on port ${WEB_PORT}`)
        );

        // Un-pipe the stdout/stderr streams
        serverProcess.stdout?.unpipe();
        serverProcess.stderr?.unpipe();

        // Unref so the parent process can exit
        serverProcess.unref();
        serverStarting = false;
        return true;
      }
    }

    logger.error('Server failed to start within timeout');
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    serverStarting = false;
    return false;
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    serverStarting = false;
    return false;
  }
}

/**
 * Build the web package if needed
 */
async function buildWebPackage(): Promise<boolean> {
  const webPath = getWebPackagePath();
  if (!webPath) {
    logger.error('Web package path not found');
    return false;
  }

  const buildDir = join(webPath, '.next');
  if (existsSync(buildDir)) {
    logger.debug('Web package already built');
    return true;
  }

  logger.info('Building web package...');

  return new Promise((resolve) => {
    const buildProcess = spawn('pnpm', ['build'], {
      cwd: webPath,
      stdio: 'inherit',
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        logger.success(chalk.green('Web package built successfully'));
        resolve(true);
      } else {
        logger.error(`Build failed with code ${code}`);
        resolve(false);
      }
    });

    buildProcess.on('error', (error) => {
      logger.error(`Build failed: ${error}`);
      resolve(false);
    });
  });
}

/**
 * Convert CLI flags to query parameters
 */
function flagsToQueryParams(flags: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();

  // Map relevant flags to query params
  const mappings: Record<string, string> = {
    backend: 'backend',
    env: 'env',
    authToken: 'authToken',
    project: 'project',
    team: 'team',
    port: 'port',
    dataDir: 'dataDir',
    runId: 'runId',
    stepId: 'stepId',
  };

  for (const [flagName, paramName] of Object.entries(mappings)) {
    const value = flags[flagName];
    if (value !== undefined && value !== '' && value !== false) {
      params.set(paramName, String(value));
    }
  }

  return params;
}

/**
 * Launch the web UI
 */
export async function launchWebUI(
  resource: string,
  id: string | undefined,
  flags: Record<string, any>
): Promise<void> {
  // Check if package is installed
  if (!isWebPackageInstalled()) {
    logger.error(
      chalk.red(
        `Web package ${WEB_PACKAGE_NAME} is not installed.\n` +
          'In development, ensure packages/web exists.\n' +
          'In production, install it with: npm install -g @vercel/workflow-web'
      )
    );
    return;
  }

  // Build if needed
  if (!(await buildWebPackage())) {
    logger.error('Failed to build web package');
    return;
  }

  // Start or reuse server
  if (!(await startWebServer())) {
    logger.error('Failed to start web server');
    return;
  }

  // Build URL with query params
  const queryParams = flagsToQueryParams(flags);
  queryParams.set('resource', resource);
  if (id) {
    queryParams.set('id', id);
  }

  const url = `http://localhost:${WEB_PORT}?${queryParams.toString()}`;

  logger.info(chalk.cyan(`Opening browser to: ${url}`));

  // Open browser
  try {
    await open(url);
  } catch (error) {
    logger.error(`Failed to open browser: ${error}`);
    logger.info(`Please open manually: ${url}`);
  }
}
