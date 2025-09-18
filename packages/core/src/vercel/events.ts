import type { PaginatedResponse } from '../world/shared.js';
import type { APIConfig } from './utils.js';
import { PaginatedResponseSchema } from '../world/shared.js';
import {
  EventSchema,
  type CreateEventRequest,
  type Event,
  type ListEventsParams,
} from '../world/events.js';
import { dateToStringReplacer, makeRequest } from './utils.js';

// Functions
export async function getWorkflowRunEvents(
  params: ListEventsParams,
  config?: APIConfig
): Promise<PaginatedResponse<Event>> {
  const searchParams = new URLSearchParams();

  const { runId, pagination } = params;

  if (pagination?.limit) searchParams.set('limit', pagination.limit.toString());
  if (pagination?.cursor) searchParams.set('cursor', pagination.cursor);

  const queryString = searchParams.toString();
  const endpoint = `/api/runs/${runId}/events${queryString ? `?${queryString}` : ''}`;

  return makeRequest({
    endpoint,
    options: { method: 'GET' },
    config,
    schema: PaginatedResponseSchema(EventSchema),
  });
}

export async function createWorkflowRunEvent(
  id: string,
  data: CreateEventRequest,
  config?: APIConfig
): Promise<Event> {
  return makeRequest({
    endpoint: `/api/runs/${id}/events`,
    options: {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: EventSchema,
  });
}
