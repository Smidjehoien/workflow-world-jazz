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

export interface WorkflowInvokePayload {
  runId: string;
  state: [WorkflowEventCommon<WorkflowTriggerEvent>, ...WorkflowEvent[]];
}
