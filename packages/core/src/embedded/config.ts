import { pidToPorts } from 'pid-port';
import z from 'zod/v4';
import { once } from '../util.js';

export const configSchema = z.object({
  port: z.coerce
    .number()
    .optional()
    .catch(undefined)
    .describe('The port the app server is running on'),
  dataDir: z
    .string()
    .catch('workflow-data')
    .describe('The directory to store workflow data'),
});

function getConfigFromEnv() {
  const provided = process.env.WORKFLOW_EMBEDDED_WORLD_CONFIG || '{}';
  let json: unknown;
  try {
    json = JSON.parse(provided);
  } catch (error) {
    throw new Error(
      `Invalid JSON in WORKFLOW_EMBEDDED_WORLD_CONFIG environment variable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const parsed = configSchema.parse(json);
  return parsed;
}

/**
 * Infers the port number from the current process by examining open ports.
 *
 * This function retrieves all ports associated with the current process ID and
 * returns the smallest port number found. If no ports are detected, it throws
 * an error suggesting explicit port configuration.
 *
 * @returns A promise that resolves to the smallest port number associated with the current process
 * @throws {Error} When no ports are detected for the current process
 */
async function inferPortFromProcess() {
  const ports = await pidToPorts(process.pid);
  if (ports.size === 0) {
    throw new Error(
      'No ports detected for current process. Please configure a port explicitly using nextConfig.workflows.embedded.port'
    );
  }
  const smallest = Math.min(...ports);
  return smallest;
}

export const config = once(() => {
  const parsed = getConfigFromEnv();

  return {
    dataDir: parsed.dataDir,
    port:
      // We prioritize the explicitly configured port.
      // Then, we check for a PORT environment variable (Next.js configures that env var).
      // Then, we fall back to inferring the port from the current process which is the most
      // flakey.
      Promise.resolve(
        parsed.port ?? (Number(process.env.PORT) || inferPortFromProcess())
      ),
  };
});
