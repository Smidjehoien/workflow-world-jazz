// API wrapper functions for workflow-server endpoints
// These functions provide a type-safe interface to interact with the workflow API
import { getVercelOidcTokenSync } from '@vercel/functions/oidc';
import type { Serializable } from './schemas.js';

/**
 * JSON replacer for Date objects: converts Dates to ISO strings
 */
function dateToStringReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * JSON reviver for Date strings: converts ISO strings to Date if key ends with _at
 */
function stringToDateReviver(key: string, value: unknown): unknown {
  if (
    typeof value === 'string' &&
    key.endsWith('_at') &&
    !Number.isNaN(Date.parse(value))
  ) {
    return new Date(value);
  }
  return value;
}

export interface WorkflowRun {
  id: string;
  workflow_name: string;
  workflow_version?: string;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'paused'
    | 'cancelled';
  input: Serializable[];
  output?: Serializable;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  owner_id: string;
  project_id: string;
  environment: string;
  execution_context?: Record<string, any>;
}

export interface Event {
  id: string;
  workflow_run_id: string;
  event_type: string;
  event_data: Record<string, any>;
  sequence_number: number;
  created_at: Date;
  created_by?: string;
}

export interface Step {
  id: string;
  workflow_run_id: string;
  step_name: string;
  step_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: Serializable[];
  output?: Serializable;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  timeout_seconds?: number;
  execution_order: number;
  depends_on?: string[];
  step_config?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export interface CreateWorkflowRunRequest {
  workflow_name: string;
  workflow_version?: string;
  arguments: Serializable[];
  execution_context?: Serializable;
  deployment_id: string;
}

export interface UpdateWorkflowRunRequest {
  status?:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'paused'
    | 'cancelled';
  output?: Serializable;
  error_message?: string;
  execution_context?: Record<string, any>;
  started_at?: Date;
  completed_at?: Date;
}

export interface CreateEventRequest {
  event_type: string;
  event_data: Serializable;
}

export interface UpdateStepRequest {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: Serializable;
  error_message?: string;
}

export interface ListWorkflowRunsParams {
  page?: number;
  limit?: number;
  workflow_name?: string;
  status?:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'paused'
    | 'cancelled';
}

export interface ListEventsParams {
  page?: number;
  limit?: number;
  event_type?: string;
  from_sequence?: number;
  to_sequence?: number;
}

export interface AuthInfo {
  owner_id: string;
  user_id: string;
  project_id: string;
  environment: string;
}

export interface HealthCheckResponse {
  success: boolean;
  data: {
    healthy: boolean;
    [key: string]: any;
  };
  message: string;
}

export class WorkflowAPIError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'WorkflowAPIError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Base configuration for API requests
 */
export interface APIConfig {
  baseUrl?: string;
  token?: string;
  headers?: RequestInit['headers'];
}

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: APIConfig = {
  baseUrl:
    process.env.WORKFLOW_API_URL || 'https://workflow-server.labs.vercel.dev',
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Helper function to make authenticated API requests
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  config: APIConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const url = `${finalConfig.baseUrl}${endpoint}`;

  const headers = new Headers({
    ...finalConfig.headers,
    ...options.headers,
  });

  const token = finalConfig.token ?? getVercelOidcTokenSync();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as any;
    throw new WorkflowAPIError(
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData.code
    );
  }

  const text = await response.text();
  // Use stringToDateReviver for parsing
  return JSON.parse(text, stringToDateReviver) as T;
}

/**
 * Get authentication information
 */
export async function getAuthInfo(config?: APIConfig): Promise<AuthInfo> {
  return makeRequest<AuthInfo>('/api', { method: 'GET' }, config);
}

/**
 * Check API health status
 */
export async function checkHealth(
  config?: APIConfig
): Promise<HealthCheckResponse> {
  return makeRequest<HealthCheckResponse>(
    '/api/health',
    { method: 'GET' },
    config
  );
}

/**
 * List workflow runs
 */
export async function listWorkflowRuns(
  params: ListWorkflowRunsParams = {},
  config?: APIConfig
): Promise<PaginatedResponse<WorkflowRun>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.workflow_name)
    searchParams.set('workflow_name', params.workflow_name);
  if (params.status) searchParams.set('status', params.status);

  const queryString = searchParams.toString();
  const endpoint = `/api/runs${queryString ? `?${queryString}` : ''}`;

  return makeRequest<PaginatedResponse<WorkflowRun>>(
    endpoint,
    { method: 'GET' },
    config
  );
}

/**
 * Create a new workflow run
 */
export async function createWorkflowRun(
  data: CreateWorkflowRunRequest,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>(
    '/api/runs/create',
    {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config
  );
}

/**
 * Get a specific workflow run
 */
export async function getWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>(`/api/runs/${id}`, { method: 'GET' }, config);
}

/**
 * Update a workflow run
 */
export async function updateWorkflowRun(
  id: string,
  data: UpdateWorkflowRunRequest,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>(
    `/api/runs/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config
  );
}

/**
 * Cancel a workflow run
 */
export async function cancelWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>(
    `/api/runs/${id}/cancel`,
    { method: 'PUT' },
    config
  );
}

/**
 * Pause a workflow run
 */
export async function pauseWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>(
    `/api/runs/${id}/pause`,
    { method: 'PUT' },
    config
  );
}

/**
 * Resume a workflow run
 */
export async function resumeWorkflowRun(
  id: string,
  config?: APIConfig
): Promise<WorkflowRun> {
  return makeRequest<WorkflowRun>(
    `/api/runs/${id}/resume`,
    { method: 'PUT' },
    config
  );
}

/**
 * Get events for a workflow run
 */
export async function getWorkflowRunEvents(
  id: string,
  params: ListEventsParams = {},
  config?: APIConfig
): Promise<PaginatedResponse<Event>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.event_type) searchParams.set('event_type', params.event_type);
  if (params.from_sequence)
    searchParams.set('from_sequence', params.from_sequence.toString());
  if (params.to_sequence)
    searchParams.set('to_sequence', params.to_sequence.toString());

  const queryString = searchParams.toString();
  const endpoint = `/api/runs/${id}/events${queryString ? `?${queryString}` : ''}`;

  return makeRequest<PaginatedResponse<Event>>(
    endpoint,
    { method: 'GET' },
    config
  );
}

/**
 * Create a new event for a workflow run
 */
export async function createWorkflowRunEvent(
  id: string,
  data: CreateEventRequest,
  config?: APIConfig
): Promise<Event> {
  return makeRequest<Event>(
    `/api/runs/${id}/events`,
    {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config
  );
}

/**
 * Get steps for a workflow run
 */
export async function getWorkflowRunSteps(
  id: string,
  config?: APIConfig
): Promise<Step[]> {
  return makeRequest<Step[]>(
    `/api/runs/${id}/steps`,
    { method: 'GET' },
    config
  );
}

/**
 * Update a step
 */
export async function updateStep(
  runId: string,
  stepId: string,
  data: UpdateStepRequest,
  config?: APIConfig
): Promise<Step> {
  return makeRequest<Step>(
    `/api/runs/${runId}/steps/${stepId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config
  );
}

/**
 * Create a new step for a workflow run
 */
export async function createStep(
  runId: string,
  data: CreateStepRequest,
  config?: APIConfig
): Promise<Step> {
  return makeRequest<Step>(
    `/api/runs/${runId}/steps`,
    {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config
  );
}

/**
 * Get a specific step for a workflow run
 */
export async function getStep(
  runId: string,
  stepId: string,
  config?: APIConfig
): Promise<Step> {
  return makeRequest<Step>(
    `/api/runs/${runId}/steps/${stepId}`,
    { method: 'GET' },
    config
  );
}

export interface CreateStepRequest {
  workflow_run_id: string;
  step_name: string;
  step_type: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  arguments: Serializable[];
  output?: Record<string, any>;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  retry_count?: number;
  max_retries?: number;
  next_retry_at?: Date;
  timeout_seconds?: number;
  execution_order: number;
  depends_on?: string[];
  step_config?: Record<string, any>;
}

/**
 * Utility function to create a configured API client
 */
export function createAPIClient(config: APIConfig) {
  return {
    getAuthInfo: () => getAuthInfo(config),
    checkHealth: () => checkHealth(config),
    listWorkflowRuns: (params?: ListWorkflowRunsParams) =>
      listWorkflowRuns(params, config),
    createWorkflowRun: (data: CreateWorkflowRunRequest) =>
      createWorkflowRun(data, config),
    getWorkflowRun: (id: string) => getWorkflowRun(id, config),
    updateWorkflowRun: (id: string, data: UpdateWorkflowRunRequest) =>
      updateWorkflowRun(id, data, config),
    cancelWorkflowRun: (id: string) => cancelWorkflowRun(id, config),
    pauseWorkflowRun: (id: string) => pauseWorkflowRun(id, config),
    resumeWorkflowRun: (id: string) => resumeWorkflowRun(id, config),
    getWorkflowRunEvents: (id: string, params?: ListEventsParams) =>
      getWorkflowRunEvents(id, params, config),
    createWorkflowRunEvent: (id: string, data: CreateEventRequest) =>
      createWorkflowRunEvent(id, data, config),
    getWorkflowRunSteps: (id: string) => getWorkflowRunSteps(id, config),
    getStep: (runId: string, stepId: string) => getStep(runId, stepId, config),
    updateStep: (runId: string, stepId: string, data: UpdateStepRequest) =>
      updateStep(runId, stepId, data, config),
    createStep: (runId: string, data: CreateStepRequest) =>
      createStep(runId, data, config),
  };
}

/**
 * Default API client instance
 */
export const api = createAPIClient(DEFAULT_CONFIG);
