import type { CreateHookRequest, Hook } from '@vercel/workflow-world';
import { HookSchema } from '@vercel/workflow-world';
import type { APIConfig } from './utils.js';
import { dateToStringReplacer, makeRequest } from './utils.js';

export async function createHook(
  runId: string,
  data: CreateHookRequest,
  config?: APIConfig
): Promise<Hook> {
  return makeRequest({
    endpoint: `/v1/hooks/create`,
    options: {
      method: 'POST',
      body: JSON.stringify(
        {
          runId,
          ...data,
        },
        dateToStringReplacer
      ),
    },
    config,
    schema: HookSchema,
  });
}

export async function getHookByToken(
  token: string,
  config?: APIConfig
): Promise<Hook> {
  return makeRequest({
    endpoint: `/v1/hooks/by-token?token=${encodeURIComponent(token)}`,
    options: {
      method: 'GET',
    },
    config,
    schema: HookSchema,
  });
}

export async function disposeHook(
  hookId: string,
  config?: APIConfig
): Promise<Hook> {
  return makeRequest({
    endpoint: `/v1/hooks/${hookId}`,
    options: { method: 'DELETE' },
    config,
    schema: HookSchema,
  });
}
