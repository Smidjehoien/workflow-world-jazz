import type { Context } from 'node:vm';
import { FatalError, STATE, STEP_INDEX, StepNotRunError } from './global.js';
import type { WorkflowEvent, WorkflowState } from './schemas.js';

/**
 * Generates a "step wrapper" function that can be used to invoke a step
 * from a workflow.
 *
 * If the step has already been run, the result is returned immediately.
 * Otherwise, an error is thrown to notify the orchestrator that the step
 * has not been run yet.
 *
 * @param stepId - The ID of the step to invoke.
 * @param context - The `vm.Context` or `globalThis` object to retrieve global state from.
 * @returns A function that can be used to invoke the step.
 */
export function useStep<Args extends unknown[], Result>(
  stepId: string,
  context: Context | typeof globalThis = globalThis
) {
  return async (...args: Args): Promise<Result> => {
    const stepIndex = (context as any)[STEP_INDEX];
    if (typeof stepIndex !== 'number') {
      throw new Error(
        'Invalid context: `useStep` must be called from a within a workflow execution environment'
      );
    } else {
      // Increment the step index for the next invocation
      (context as any)[STEP_INDEX]++;
    }
    const event = (context as any)[STATE][stepIndex];
    if (event) {
      if (event.error) {
        // Step failed - bubble up to workflow
        if (event.fatal) {
          throw new FatalError(event.error);
        }
        throw new Error(event.error);
      } else {
        // Step has already completed
        return event.result;
      }
    } else {
      // Notify workflow dispatcher that this step has not been run
      throw new StepNotRunError(stepId, args);
    }
  };
}

export interface WorkflowContext {
  stepIndex: number;
  state: WorkflowState;
  invocationsQueue: {
    stepId: string;
    args: unknown[];
  }[];
  onWorkflowError: (error: Error) => void;
}

export function createUseStep(ctx: WorkflowContext) {
  return function useStep<Args extends unknown[], Result>(stepId: string) {
    return (...args: Args): Promise<Result> => {
      const stepIndex = ctx.stepIndex++;
      const event = ctx.state[stepIndex] as WorkflowEvent | undefined;
      ctx.invocationsQueue.push({ stepId, args });
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
