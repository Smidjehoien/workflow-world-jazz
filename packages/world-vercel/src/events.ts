import {
  type CreateEventParams,
  type CreateEventRequest,
  type Event,
  EventSchema,
  type ListEventsParams,
  type PaginatedResponse,
  PaginatedResponseSchema,
} from '@vercel/workflow-world';
import type { APIConfig } from './utils.js';
import {
  DEFAULT_RESOLVE_DATA_OPTION,
  dateToStringReplacer,
  makeRequest,
} from './utils.js';

// Helper to filter event data based on resolveData setting
function filterEventData(event: any, resolveData: 'none' | 'all'): Event {
  if (resolveData === 'none') {
    const { eventData: _eventData, ...rest } = event;
    return rest;
  }
  return event;
}

// Functions
export async function getWorkflowRunEvents(
  params: ListEventsParams,
  config?: APIConfig
): Promise<PaginatedResponse<Event>> {
  const searchParams = new URLSearchParams();

  const {
    runId,
    pagination,
    resolveData = DEFAULT_RESOLVE_DATA_OPTION,
  } = params;

  if (pagination?.limit) searchParams.set('limit', pagination.limit.toString());
  if (pagination?.cursor) searchParams.set('cursor', pagination.cursor);
  if (pagination?.sortOrder)
    searchParams.set('sortOrder', pagination.sortOrder);

  const queryString = searchParams.toString();
  const endpoint = `/v1/runs/${runId}/events${queryString ? `?${queryString}` : ''}`;

  const response = await makeRequest({
    endpoint,
    options: { method: 'GET' },
    config,
    schema: PaginatedResponseSchema(EventSchema),
  });

  return {
    ...response,
    data: response.data.map((event: any) =>
      filterEventData(event, resolveData)
    ),
  };
}

export async function createWorkflowRunEvent(
  id: string,
  data: CreateEventRequest,
  params?: CreateEventParams,
  config?: APIConfig
): Promise<Event> {
  const resolveData = params?.resolveData ?? DEFAULT_RESOLVE_DATA_OPTION;

  const event = await makeRequest({
    endpoint: `/v1/runs/${id}/events`,
    options: {
      method: 'POST',
      body: JSON.stringify(data, dateToStringReplacer),
    },
    config,
    schema: EventSchema,
  });

  return filterEventData(event, resolveData);
}
