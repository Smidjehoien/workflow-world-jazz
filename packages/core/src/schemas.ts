import { z } from 'zod';

// OpenTelemetry trace context for distributed tracing
const TraceCarrierSchema = z.record(z.string(), z.string());

export const WorkflowInvokePayloadSchema = z.object({
  runId: z.string(),
  traceCarrier: TraceCarrierSchema.optional(),
});

export const StepInvokePayloadSchema = z.object({
  workflowName: z.string(),
  workflowStartedAt: z.number(),
  workflowRunId: z.string(),
  stepId: z.string(),
  traceCarrier: TraceCarrierSchema.optional(),
});

const MethodEnumSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
]);

export const WebhookTokenPayloadSchema = z.object({
  workflowName: z.string(),
  workflowRunId: z.string(),
  webhookId: z.string(),
  method: z.union([MethodEnumSchema, z.array(MethodEnumSchema)]).optional(),
});

export type WorkflowInvokePayload = z.infer<typeof WorkflowInvokePayloadSchema>;
export type StepInvokePayload = z.infer<typeof StepInvokePayloadSchema>;
export type WebhookTokenPayload = z.infer<typeof WebhookTokenPayloadSchema>;

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
  | ArrayBuffer
  | BigInt64Array
  | BigUint64Array
  | Date
  | Float32Array
  | Float64Array
  | Headers
  | Int8Array
  | Int16Array
  | Int32Array
  | Map<Serializable, Serializable>
  | ReadableStream<Uint8Array>
  | RegExp
  | Response
  | Set<Serializable>
  | URL
  | URLSearchParams
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | WritableStream<Uint8Array>;
