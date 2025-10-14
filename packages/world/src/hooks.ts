import { z } from 'zod';

// Hook schemas
export const HookSchema = z.object({
  runId: z.string(),
  hookId: z.string(),
  token: z.string(),
  ownerId: z.string(),
  projectId: z.string(),
  environment: z.string(),
  createdAt: z.coerce.date(),
});

// Inferred types
export type Hook = z.infer<typeof HookSchema>;

// Request types
export interface CreateHookRequest {
  hookId: string;
  token: string;
}

export interface GetHookByTokenParams {
  token: string;
}
