import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  type CreateEventRequest,
  type CreateWorkflowRunRequest,
  cancelWorkflowRun,
  checkHealth,
  createWorkflowRun,
  createWorkflowRunEvent,
  type Event,
  getAuthInfo,
  getWorkflowRun,
  getWorkflowRunEvents,
  getWorkflowRunSteps,
  listWorkflowRuns,
  pauseWorkflowRun,
  resumeWorkflowRun,
  type Step,
  type UpdateStepRequest,
  type UpdateWorkflowRunRequest,
  updateStep,
  updateWorkflowRun,
  WorkflowAPIError,
  type WorkflowRun,
} from './backend.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Workflow API Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWorkflowRun: WorkflowRun = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    workflow_name: 'test-workflow',
    status: 'running',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    owner_id: 'owner-123',
    project_id: 'project-123',
    environment: 'development',
  };

  const mockEvent: Event = {
    id: 'event-123',
    workflow_run_id: '123e4567-e89b-12d3-a456-426614174000',
    event_type: 'step_completed',
    event_data: { step_id: 'step-123' },
    sequence_number: 1,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
  };

  const mockStep: Step = {
    id: 'step-123',
    workflow_run_id: '123e4567-e89b-12d3-a456-426614174000',
    step_name: 'test-step',
    step_type: 'http',
    status: 'completed',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    retry_count: 0,
    max_retries: 3,
  };

  describe('Date coercion', () => {
    it('should convert ISO strings to Date objects in API responses', async () => {
      const mockResponseWithStrings = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_name: 'test-workflow',
        status: 'running',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        owner_id: 'owner-123',
        project_id: 'project-123',
        environment: 'development',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponseWithStrings),
      });

      const result = await getWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.created_at.getTime()).toBe(
        new Date('2024-01-01T00:00:00.000Z').getTime()
      );
      expect(result.updated_at.getTime()).toBe(
        new Date('2024-01-01T00:00:00.000Z').getTime()
      );
    });

    it('should convert Date objects to ISO strings in API requests', async () => {
      const updateData: UpdateWorkflowRunRequest = {
        status: 'completed',
        started_at: new Date('2024-01-01T00:00:00.000Z'),
        completed_at: new Date('2024-01-01T01:00:00.000Z'),
      };

      const expectedRequestBody = {
        status: 'completed',
        started_at: '2024-01-01T00:00:00.000Z',
        completed_at: '2024-01-01T01:00:00.000Z',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflowRun, ...updateData }),
      });

      await updateWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000',
        updateData
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://workflow-server.labs.vercel.dev/api/runs/123e4567-e89b-12d3-a456-426614174000',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(expectedRequestBody),
        })
      );
    });

    it('should handle nested Date objects in complex objects', async () => {
      const createData: any = {
        workflow_name: 'test-workflow',
        arguments: ['arg1', 'arg2'],
        deployment_id: 'deployment-123',
        execution_context: {
          started_at: new Date('2024-01-01T00:00:00.000Z'),
          metadata: {
            created_at: new Date('2024-01-01T00:00:00.000Z'),
          },
        },
      };

      const expectedRequestBody = {
        workflow_name: 'test-workflow',
        arguments: ['arg1', 'arg2'],
        deployment_id: 'deployment-123',
        execution_context: {
          started_at: '2024-01-01T00:00:00.000Z',
          metadata: {
            created_at: '2024-01-01T00:00:00.000Z',
          },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflowRun),
      });

      await createWorkflowRun(createData);

      expect(fetch).toHaveBeenCalledWith(
        'https://workflow-server.labs.vercel.dev/api/runs/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(expectedRequestBody),
        })
      );
    });

    it('should handle arrays with Date objects', async () => {
      const eventData: any = {
        event_type: 'step_completed',
        event_data: {
          step_id: 'step-123',
          timestamps: [
            new Date('2024-01-01T00:00:00.000Z'),
            new Date('2024-01-01T01:00:00.000Z'),
          ],
        },
      };

      const expectedRequestBody = {
        event_type: 'step_completed',
        event_data: {
          step_id: 'step-123',
          timestamps: ['2024-01-01T00:00:00.000Z', '2024-01-01T01:00:00.000Z'],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvent),
      });

      await createWorkflowRunEvent(
        '123e4567-e89b-12d3-a456-426614174000',
        eventData
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://workflow-server.labs.vercel.dev/api/runs/123e4567-e89b-12d3-a456-426614174000/events',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(expectedRequestBody),
        })
      );
    });
  });

  describe('getAuthInfo', () => {
    it('should fetch auth info successfully', async () => {
      const mockResponse = {
        owner_id: 'owner-123',
        user_id: 'user-123',
        project_id: 'project-123',
        environment: 'development',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getAuthInfo();
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://workflow-server.labs.vercel.dev/api',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('checkHealth', () => {
    it('should check health status successfully', async () => {
      const mockResponse = {
        success: true,
        data: { healthy: true },
        message: 'Service is healthy',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkHealth();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listWorkflowRuns', () => {
    it('should list workflow runs successfully', async () => {
      const mockResponse = {
        success: true,
        data: [mockWorkflowRun],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          has_more: false,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await listWorkflowRuns({ page: 1, limit: 50 });
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://workflow-server.labs.vercel.dev/api/runs?page=1&limit=50',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('createWorkflowRun', () => {
    it('should create workflow run successfully', async () => {
      const createData: CreateWorkflowRunRequest = {
        workflow_name: 'test-workflow',
        arguments: ['arg1', 'arg2'],
        deployment_id: 'deployment-123',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflowRun),
      });

      const result = await createWorkflowRun(createData);
      expect(result).toEqual(mockWorkflowRun);
      expect(fetch).toHaveBeenCalledWith(
        'https://workflow-server.labs.vercel.dev/api/runs/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createData),
        })
      );
    });
  });

  describe('getWorkflowRun', () => {
    it('should get workflow run successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflowRun),
      });

      const result = await getWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result).toEqual(mockWorkflowRun);
    });
  });

  describe('updateWorkflowRun', () => {
    it('should update workflow run successfully', async () => {
      const updateData: UpdateWorkflowRunRequest = {
        status: 'completed',
        output: { result: 'success' },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflowRun, ...updateData }),
      });

      const result = await updateWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000',
        updateData
      );
      expect(result).toEqual({ ...mockWorkflowRun, ...updateData });
    });
  });

  describe('cancelWorkflowRun', () => {
    it('should cancel workflow run successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockWorkflowRun, status: 'cancelled' }),
      });

      const result = await cancelWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result.status).toBe('cancelled');
    });
  });

  describe('pauseWorkflowRun', () => {
    it('should pause workflow run successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflowRun, status: 'paused' }),
      });

      const result = await pauseWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result.status).toBe('paused');
    });
  });

  describe('resumeWorkflowRun', () => {
    it('should resume workflow run successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflowRun, status: 'running' }),
      });

      const result = await resumeWorkflowRun(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result.status).toBe('running');
    });
  });

  describe('getWorkflowRunEvents', () => {
    it('should get workflow run events successfully', async () => {
      const mockResponse = {
        success: true,
        data: [mockEvent],
        pagination: {
          page: 1,
          limit: 100,
          total: 1,
          has_more: false,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getWorkflowRunEvents(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createWorkflowRunEvent', () => {
    it('should create workflow run event successfully', async () => {
      const eventData: CreateEventRequest = {
        event_type: 'step_completed',
        event_data: { step_id: 'step-123' },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvent),
      });

      const result = await createWorkflowRunEvent(
        '123e4567-e89b-12d3-a456-426614174000',
        eventData
      );
      expect(result).toEqual(mockEvent);
    });
  });

  describe('getWorkflowRunSteps', () => {
    it('should get workflow run steps successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockStep]),
      });

      const result = await getWorkflowRunSteps(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result).toEqual([mockStep]);
    });
  });

  describe('updateStep', () => {
    it('should update step successfully', async () => {
      const updateData: UpdateStepRequest = {
        status: 'completed',
        output: { result: 'success' },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockStep, ...updateData }),
      });

      const result = await updateStep(
        '123e4567-e89b-12d3-a456-426614174000',
        'step-123',
        updateData
      );
      expect(result).toEqual({ ...mockStep, ...updateData });
    });
  });

  describe('error handling', () => {
    it('should throw WorkflowAPIError on HTTP error', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Workflow run not found' }),
      });

      await expect(getWorkflowRun('invalid-id')).rejects.toThrow(
        WorkflowAPIError
      );
    });

    it('should handle network errors', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        getWorkflowRun('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow('Network error');
    });
  });
});
