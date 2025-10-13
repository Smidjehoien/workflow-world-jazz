import { getVercelOidcToken } from '@vercel/oidc';
import { WorkflowAPIError } from '@vercel/workflow-errors';
import type { z } from 'zod';

export interface APIConfig {
  baseUrl?: string;
  token?: string;
  headers?: RequestInit['headers'];
  projectConfig?: {
    projectId?: string;
    teamId?: string;
    environment?: string;
  };
}

export const DEFAULT_RESOLVE_DATA_OPTION = 'all';

export function dateToStringReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export const getHttpConfig = (
  config?: APIConfig
): { baseUrl: string; headers: RequestInit['headers'] } => {
  const projectConfig = config?.projectConfig;

  const headers: Record<string, string> = {};
  if (projectConfig) {
    headers['x-vercel-environment'] = projectConfig.environment || 'production';
    if (projectConfig.projectId) {
      headers['x-vercel-project-id'] = projectConfig.projectId;
    }
    if (projectConfig.teamId) {
      headers['x-vercel-team-id'] = projectConfig.teamId;
    }
  }
  // Merge with config headers
  Object.assign(headers, config?.headers || {}); // We honor user-provided baseUrl first
  if (config?.baseUrl) {
    return { baseUrl: config.baseUrl, headers };
  }

  // If projectConfig is provided (only necessary outside of vercel deployments),
  // we default the baseUrl to the API proxy
  const shouldUseProxy = projectConfig?.projectId && projectConfig?.teamId;
  return {
    baseUrl: shouldUseProxy
      ? `https://api.vercel.com/v1/workflow`
      : 'https://vercel-workflow.com/api',
    headers,
  };
};

export async function makeRequest<T>({
  endpoint,
  options = {},
  config = {},
  schema,
}: {
  endpoint: string;
  options?: RequestInit;
  config?: APIConfig;
  schema: z.ZodSchema<T>;
}): Promise<T> {
  const { baseUrl, headers: configHeaders } = getHttpConfig(config);

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...configHeaders,
    ...options.headers,
  });

  const token = config.token ?? (await getVercelOidcToken());
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as any;
    if (process.env.DEBUG === '1') {
      const stringifiedHeaders = Array.from(headers.entries())
        .map(([key, value]: [string, string]) => `-H "${key}: ${value}"`)
        .join(' ');
      console.error(
        `Failed to fetch, reproduce with:\ncurl -X ${options.method} ${stringifiedHeaders} "${url}"`
      );
    }
    throw new WorkflowAPIError(
      errorData.message ||
        `${options.method ?? 'GET'} ${endpoint} -> HTTP ${response.status}: ${response.statusText}`,
      { url, status: response.status, code: errorData.code }
    );
  }

  try {
    const text = await response.text();
    return schema.parse(JSON.parse(text));
  } catch (error) {
    throw new WorkflowAPIError(
      `Failed to parse server response for ${options.method ?? 'GET'} ${endpoint}`,
      { url, cause: error }
    );
  }
}
