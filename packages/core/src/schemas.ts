import { z } from 'zod';

export const WorkflowInvokePayloadSchema = z.object({
  runId: z.string(),
});

export const StepInvokePayloadSchema = z.object({
  workflowName: z.string(),
  workflowRunId: z.string(),
  stepId: z.string(),
});

export type WorkflowInvokePayload = z.infer<typeof WorkflowInvokePayloadSchema>;
export type StepInvokePayload = z.infer<typeof StepInvokePayloadSchema>;

/**
 * A serializable value:
 * Any valid JSON object is serializable
 *
 * @example
 *
 * ```ts
 * // any valid JSON object is serializable
 * const anyJson: Serializable = { foo: "bar" };
 * ```
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };
// TODO: add support for binary data and streams using @vercel/queue
// | ArrayBuffer;
