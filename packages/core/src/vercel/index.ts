import type { APIConfig } from './utils.js';
import type { World } from '../world/interfaces.js';
import { createAuth } from './auth.js';
import { createQueue } from './queue.js';
import { createStorage } from './storage.js';
import { createStreamer } from './streamer.js';

// Re-export types from world directory (which are now the canonical source)
export type { AuthInfo, HealthCheckResponse } from '../world/auth.js';
export type {
  CreateEventRequest,
  Event,
  ListEventsParams,
} from '../world/events.js';
export type {
  CreateWorkflowRunRequest,
  ListWorkflowRunsParams,
  UpdateWorkflowRunRequest,
  WorkflowRun,
  WorkflowRunStatus,
} from '../world/runs.js';
export type {
  CreateStepRequest,
  ListWorkflowRunStepsParams,
  Step,
  StepStatus,
  UpdateStepRequest,
} from '../world/steps.js';
export type {
  CreateWebhookRequest,
  ListWebhooksByUrlParams,
  Webhook,
} from '../world/webhooks.js';

// Re-export vercel-specific utilities and functions
export { createQueue } from './queue.js';
export { createStorage } from './storage.js';
export { createStreamer } from './streamer.js';
export { DEFAULT_CONFIG } from './utils.js';
export type { APIConfig } from './utils.js';

export function createVercelWorld(config?: APIConfig): World {
  return {
    ...createQueue(),
    ...createStorage(config),
    ...createAuth(config),
    ...createStreamer(config),
  };
}
