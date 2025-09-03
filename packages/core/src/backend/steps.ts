import { z } from 'zod';
import type { Serializable } from '../schemas.js';
import type {
  APIConfig,
  PaginatedResponse,
  PaginationOptions,
} from './shared.js';
import { PaginatedResponseSchema } from './shared.js';
import { dateToStringReplacer, makeRequest } from './utils.js';

// Step schemas
export const StepStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const StepSchema = z.object({
  runId: z.string(),
  stepId: z.string(),
  stepName: z.string(),
  status: StepStatusSchema,
  input: z.array(z.any()),
  output: z.any().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  attempt: z.number(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Inferred types
export type StepStatus = z.infer<typeof StepStatusSchema>;
export type Step = z.infer<typeof StepSchema>;

// Request types
export interface CreateStepRequest {
  stepId: string;
  stepName: string;
  input: Serializable[];
}

export interface UpdateStepRequest {
  status?: StepStatus;
  output?: Serializable;
  error?: string;
  errorCode?: string;
}

export interface ListWorkflowRunStepsParams {
  runId: string;
  pagination?: PaginationOptions;
}

// Functions
export async function listWorkflowRunSteps(
  params: ListWorkflowRunStepsParams,
  config?: APIConfig
): Promise<PaginatedResponse<Step>> {
  const searchParams = new URLSearchParams();
  if (params.pagination?.cursor)
    searchParams.set('cursor', params.pagination.cursor);
  if (params.pagination?.limit)
    searchParams.set('limit', params.pagination.limit.toString());

  const queryString = searchParams.toString();
  const endpoint = `/api/runs/${params.runId}/steps${queryString ? `?${queryString}` : ''}`;

  return makeRequest<PaginatedResponse<Step>>({
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
  return makeRequest<Step>({
    endpoint: `/api/runs/${runId}/steps`,
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
  return makeRequest<Step>({
    endpoint: `/api/runs/${runId}/steps/${stepId}`,
    options: {
      method: 'PUT',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: StepSchema,
  });
}

export async function getStep(
  runId: string,
  stepId: string,
  config?: APIConfig
): Promise<Step> {
  return makeRequest<Step>({
    endpoint: `/api/runs/${runId}/steps/${stepId}`,
    options: { method: 'GET' },
    config,
    schema: StepSchema,
  });
}
