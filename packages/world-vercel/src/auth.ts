import type { APIConfig } from './utils.js';
import type { AuthProvider } from '@vercel/workflow-world';
import {
  AuthInfoSchema,
  HealthCheckResponseSchema,
  type AuthInfo,
  type HealthCheckResponse,
} from '@vercel/workflow-world';
import { makeRequest } from './utils.js';

// Functions
export async function getAuthInfo(config?: APIConfig): Promise<AuthInfo> {
  return makeRequest({
    endpoint: '/api',
    options: { method: 'GET' },
    config,
    schema: AuthInfoSchema,
  });
}

export async function checkHealth(
  config?: APIConfig
): Promise<HealthCheckResponse> {
  return makeRequest({
    endpoint: '/api/health',
    options: { method: 'GET' },
    config,
    schema: HealthCheckResponseSchema,
  });
}

export function createAuth(config?: APIConfig): AuthProvider {
  return {
    checkHealth: () => checkHealth(config),
    getAuthInfo: () => getAuthInfo(config),
  };
}
