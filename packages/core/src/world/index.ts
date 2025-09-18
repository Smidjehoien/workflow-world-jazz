import { createEmbeddedWorld } from '../embedded/world.js';
import { shouldUseEmbeddedWorld } from '../env.js';
import { createVercelWorld } from '../vercel/index.js';
import type { World } from './interfaces.js';

// World selection logic
export const world: World = shouldUseEmbeddedWorld()
  ? createEmbeddedWorld()
  : createVercelWorld();

// Re-export all types and utilities
export type * from './auth.js';
export type * from './events.js';
export type * from './interfaces.js';
export type * from './queue.js';
export type * from './runs.js';
export type * from './shared.js';
export type * from './steps.js';
export type * from './webhooks.js';

// Re-export schemas that might be needed at runtime
export { AuthInfoSchema, HealthCheckResponseSchema } from './auth.js';
export { CreateEventSchema, EventSchema, EventTypeSchema } from './events.js';
export { MessageId, QueuePrefix, ValidQueueName } from './queue.js';
export { WorkflowRunSchema, WorkflowRunStatusSchema } from './runs.js';
export { PaginatedResponseSchema } from './shared.js';
export { StepSchema, StepStatusSchema } from './steps.js';
export { WebhookSchema } from './webhooks.js';
