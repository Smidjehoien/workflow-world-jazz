// TODO: use `zod`?

export interface WorkflowTriggerEvent {
  arguments: unknown[];
}

export interface WorkflowStepResult {
  result: unknown;
}

export interface WorkflowStepFatalError {
  error: string;
  stack?: string;
  fatal: true;
}

export type WorkflowEventCommon<T> = T & {
  t: number;
};

export type WorkflowEvent =
  | WorkflowEventCommon<WorkflowStepResult>
  | WorkflowEventCommon<WorkflowStepFatalError>;

export type WorkflowState = [
  WorkflowEventCommon<WorkflowTriggerEvent>,
  ...WorkflowEvent[],
];

export interface WorkflowInvokePayload {
  workflowId: string;
  runId: string;
  callbackUrl: string;
  state: WorkflowState;
}

export interface StepInvokePayload extends WorkflowInvokePayload {
  stepId: string;
  arguments: Serializable[];
}

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
