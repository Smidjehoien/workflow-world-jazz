import { FatalError, StepNotRunError } from './global.js';
import type { Serializable, WorkflowEvent, WorkflowState } from './schemas.js';

export interface WorkflowContext {
  stepIndex: number;
  state: WorkflowState;
  invocationsQueue: {
    stepId: string;
    args: Serializable[];
  }[];
  onWorkflowError: (error: Error) => void;
}

export function createUseStep(ctx: WorkflowContext) {
  return function useStep<Args extends Serializable[], Result>(stepId: string) {
    return (...args: Args): Promise<Result> => {
      const stepIndex = ctx.stepIndex++;
      const event = ctx.state[stepIndex] as WorkflowEvent | undefined;
      ctx.invocationsQueue.push({ stepId, args });
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Necessary
      return new Promise((resolve, reject) => {
        if (event) {
          if ('error' in event) {
            // Step failed - bubble up to workflow
            if (event.fatal) {
              return reject(new FatalError(event.error));
            }
            return reject(new Error(event.error));
          } else {
            // Step has already completed
            return resolve(event.result as Result);
          }
        } else {
          // Notify workflow handler that this step has not been run.
          // Crucially, this step Promise does not resolve so that the user
          // workflow code does not proceed any further.
          ctx.onWorkflowError(new StepNotRunError(stepId, args));
        }
      });
    };
  };
}
