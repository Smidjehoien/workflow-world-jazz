import { z } from 'zod';
import type { APIConfig } from './shared.js';
import { makeRequest } from './utils.js';

// Auth schemas
export const AuthInfoSchema = z.object({
  ownerId: z.string(),
  projectId: z.string(),
  environment: z.string(),
  userId: z.string().optional(),
});

export const HealthCheckResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      healthy: z.boolean(),
    })
    .and(z.record(z.string(), z.any())),
  message: z.string(),
});

// Inferred types
export type AuthInfo = z.infer<typeof AuthInfoSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

// Functions
export async function getAuthInfo(config?: APIConfig): Promise<AuthInfo> {
  return makeRequest<AuthInfo>({
    endpoint: '/api',
    options: { method: 'GET' },
    config,
    schema: AuthInfoSchema,
  });
}

export async function checkHealth(
  config?: APIConfig
): Promise<HealthCheckResponse> {
  return makeRequest<HealthCheckResponse>({
    endpoint: '/api/health',
    options: { method: 'GET' },
    config,
    schema: HealthCheckResponseSchema,
  });
}
