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
  arguments: unknown[];
}
