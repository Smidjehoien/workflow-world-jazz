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
  // Standard JSON types
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable }
  // Special types that need special handling when
  // serialized/deserialized (see `serialization.ts`)
  | Date
  | Headers
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | Response
  | ReadableStream<Uint8Array>
  | WritableStream<Uint8Array>
  | URL
  | URLSearchParams;
