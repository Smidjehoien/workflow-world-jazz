import { z } from 'zod';
import type { Serializable } from '../schemas.js';
import type {
  APIConfig,
  PaginatedResponse,
  PaginationOptions,
} from './shared.js';
import { PaginatedResponseSchema } from './shared.js';
import { dateToStringReplacer, makeRequest } from './utils.js';

// Workflow run schemas
export const WorkflowRunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'paused',
  'cancelled',
]);

export const WorkflowRunSchema = z.object({
  runId: z.string(),
  ownerId: z.string(),
  projectId: z.string(),
  environment: z.string(),
  deploymentId: z.string(),
  userId: z.string().optional(),
  status: WorkflowRunStatusSchema,
  workflowName: z.string(),
  executionContext: z.record(z.string(), z.any()).optional(),
  input: z.array(z.any()),
  output: z.any().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Inferred types
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

// Request types
export interface CreateWorkflowRunRequest {
  deploymentId: string;
  workflowName: string;
  input: Serializable[];
  executionContext?: Serializable;
}

export interface UpdateWorkflowRunRequest {
  status?: WorkflowRunStatus;
  output?: Serializable;
  error?: string;
  errorCode?: string;
  executionContext?: Record<string, any>;
}

export interface ListWorkflowRunsParams {
  workflowName?: string;
  status?: WorkflowRunStatus;
  pagination?: PaginationOptions;
}

// Functions

/**
 * This query technically works but should be used sparingly till the backend
 * uses CH to resolve this instead of scanning a dynamo table.
 */
export async function listWorkflowRuns(
  params: ListWorkflowRunsParams = {},
  config?: APIConfig
): Promise<PaginatedResponse<WorkflowRun>> {
  const { workflowName, status, pagination } = params;

  const searchParams = new URLSearchParams();

  if (workflowName) searchParams.set('workflow_name', workflowName);
  if (status) searchParams.set('status', status);
  if (pagination?.limit) searchParams.set('limit', pagination.limit.toString());
  if (pagination?.cursor) searchParams.set('cursor', pagination.cursor);

  const queryString = searchParams.toString();
  const endpoint = `/api/runs${queryString ? `?${queryString}` : ''}`;

  return makeRequest<PaginatedResponse<WorkflowRun>>({
    endpoint,
    options: { method: 'GET' },
    config,
    schema: PaginatedResponseSchema(WorkflowRunSchema),
  });
}

export async function createWorkflowRun(
  data: CreateWorkflowRunRequest,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>({
    endpoint: '/api/runs/create',
    options: {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: WorkflowRunSchema,
  });
}

export async function getWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>({
    endpoint: `/api/runs/${id}`,
    options: { method: 'GET' },
    config,
    schema: WorkflowRunSchema,
  });
}

export async function updateWorkflowRun(
  id: string,
  data: UpdateWorkflowRunRequest,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>({
    endpoint: `/api/runs/${id}`,
    options: {
      method: 'PUT',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: WorkflowRunSchema,
  });
}

export async function cancelWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>({
    endpoint: `/api/runs/${id}/cancel`,
    options: { method: 'PUT' },
    config,
    schema: WorkflowRunSchema,
  });
}

export async function pauseWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>({
    endpoint: `/api/runs/${id}/pause`,
    options: { method: 'PUT' },
    config,
    schema: WorkflowRunSchema,
  });
}

export async function resumeWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>({
    endpoint: `/api/runs/${id}/resume`,
    options: { method: 'PUT' },
    config,
    schema: WorkflowRunSchema,
  });
}
