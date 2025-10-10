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

export const WebhookSchema = HookSchema.extend({
  response: z.any().optional(),
});

// Inferred types
export type Hook = z.infer<typeof HookSchema>;
export type Webhook = z.infer<typeof WebhookSchema>;

// Request types
export interface CreateHookRequest {
  hookId: string;
  token: string;

  // Only used for webhooks when using a static response
  response?: any;
}

export interface GetHookByTokenParams {
  token: string;
}
