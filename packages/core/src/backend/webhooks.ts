import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { APIConfig, PaginatedResponse } from './shared.js';
import { PaginatedResponseSchema } from './shared.js';
import { dateToStringReplacer, makeRequest } from './utils.js';

// Webhook schemas
export const WebhookSchema = z.object({
  runId: z.string(),
  webhookId: z.string(),
  ownerId: z.string(),
  projectId: z.string(),
  environment: z.string(),
  url: z.string().optional(),
  allowedMethods: z.array(z.string()),
  searchParamsSchema: z.record(z.string(), z.custom<JSONSchema7>()).optional(),
  headersSchema: z.record(z.string(), z.custom<JSONSchema7>()).optional(),
  bodySchema: z.custom<JSONSchema7>().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Inferred types
export type Webhook = z.infer<typeof WebhookSchema>;

// Request types
export interface CreateWebhookRequest {
  webhookId: string;
  url?: string;
  allowedMethods?: string[];
  searchParamsSchema?: Record<string, JSONSchema7>;
  headersSchema?: Record<string, JSONSchema7>;
  bodySchema?: JSONSchema7;
}

export interface ListWebhooksByUrlParams {
  page?: number;
  limit?: number;
}

// Functions
export async function createWebhook(
  runId: string,
  data: CreateWebhookRequest,
  config?: APIConfig
): Promise<Webhook> {
  return makeRequest<Webhook>({
    endpoint: '/api/webhooks/create',
    options: {
      method: 'POST',
      body: JSON.stringify({ ...data, runId }, dateToStringReplacer),
    },
    config,
    schema: WebhookSchema,
  });
}

export async function getWebhook(
  webhookId: string,
  deploymentId: string,
  config?: APIConfig
): Promise<Webhook> {
  return makeRequest<Webhook>({
    endpoint: `/api/webhooks/${webhookId}?deploymentId=${deploymentId}`,
    options: { method: 'GET' },
    config,
    schema: WebhookSchema,
  });
}

export async function disposeWebhook(
  webhookId: string,
  deploymentId: string,
  config?: APIConfig
): Promise<Webhook> {
  return makeRequest<Webhook>({
    endpoint: `/api/webhooks/${webhookId}?deploymentId=${deploymentId}`,
    options: { method: 'DELETE' },
    config,
    schema: WebhookSchema,
  });
}

export async function getWebhooksByUrl(
  url: string,
  deploymentId: string,
  params: ListWebhooksByUrlParams = {},
  config?: APIConfig
): Promise<PaginatedResponse<Webhook>> {
  const searchParams = new URLSearchParams();
  searchParams.set('url', url);
  searchParams.set('deploymentId', deploymentId);

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const queryString = searchParams.toString();
  const endpoint = `/api/webhooks/by-url?${queryString}`;

  return makeRequest<PaginatedResponse<Webhook>>({
    endpoint,
    options: { method: 'GET' },
    config,
    schema: PaginatedResponseSchema(WebhookSchema),
  });
}
