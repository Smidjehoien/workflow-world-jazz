import {
  type CreateStepRequest,
  type ListWorkflowRunStepsParams,
  type PaginatedResponse,
  PaginatedResponseSchema,
  type Step,
  StepSchema,
  type UpdateStepRequest,
} from '@vercel/workflow-world';
import type { APIConfig } from './utils.js';
import { dateToStringReplacer, makeRequest } from './utils.js';

// Functions
export async function listWorkflowRunSteps(
  params: ListWorkflowRunStepsParams,
  config?: APIConfig
): Promise<PaginatedResponse<Step>> {
  const { runId, pagination } = params;

  const searchParams = new URLSearchParams();

  if (pagination?.cursor) searchParams.set('cursor', pagination.cursor);
  if (pagination?.limit) searchParams.set('limit', pagination.limit.toString());
  if (pagination?.sortOrder)
    searchParams.set('sortOrder', pagination.sortOrder);

  const queryString = searchParams.toString();
  const endpoint = `/v1/runs/${runId}/steps${queryString ? `?${queryString}` : ''}`;

  return makeRequest({
    endpoint,
    options: { method: 'GET' },
    config,
    schema: PaginatedResponseSchema(StepSchema),
  });
}

export async function createStep(
  runId: string,
  data: CreateStepRequest,
  config?: APIConfig
): Promise<Step> {
  return makeRequest({
    endpoint: `/v1/runs/${runId}/steps`,
    options: {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: StepSchema,
  });
}

export async function updateStep(
  runId: string,
  stepId: string,
  data: UpdateStepRequest,
  config?: APIConfig
): Promise<Step> {
  return makeRequest({
    endpoint: `/v1/runs/${runId}/steps/${stepId}`,
    options: {
      method: 'PUT',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: StepSchema,
  });
}

export async function getStep(
  runId: string | undefined,
  stepId: string,
  config?: APIConfig
): Promise<Step> {
  const endpoint = runId
    ? `/v1/runs/${runId}/steps/${stepId}`
    : `/v1/steps/${stepId}`;
  return makeRequest({
    endpoint,
    options: { method: 'GET' },
    config,
    schema: StepSchema,
  });
}
