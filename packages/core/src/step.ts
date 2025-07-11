import type { Event } from './backend.js';
import { FatalError, StepNotRunError } from './global.js';
import type { Serializable } from './schemas.js';

export interface WorkflowContext {
  stepIndex: number;
  events: Event[];
  invocationsQueue: {
    stepName: string;
    args: Serializable[];
    invocationId: string;
  }[];
  onWorkflowError: (error: Error) => void;
  randomUUID: () => string;
}

export function createUseStep(ctx: WorkflowContext) {
  return function useStep<Args extends Serializable[], Result>(
    stepName: string
  ) {
    return (...args: Args): Promise<Result> => {
      const stepIndex = ctx.stepIndex++;
      const event = ctx.events[stepIndex] as Event | undefined;
      const invocationId = ctx.randomUUID();
      ctx.invocationsQueue.push({ stepName, args, invocationId });

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Necessary
      return new Promise((resolve, reject) => {
        if (event) {
          if (event.event_type === 'step_failed') {
            // Step failed - bubble up to workflow
            if (event.event_data.fatal) {
              return reject(new FatalError(event.event_data.error));
            }
            return reject(new Error(event.event_data.error));
          } else if (event.event_type === 'step_result') {
            // Step has already completed
            return resolve(event.event_data.result);
          } else {
            return reject(
              new FatalError(`Unexpected event type: "${event.event_type}"`)
            );
          }
        } else {
          // Notify workflow handler that this step has not been run.
          // Crucially, this step Promise does not resolve so that the user
          // workflow code does not proceed any further.
          ctx.onWorkflowError(new StepNotRunError(stepName, args));
        }
      });
    };
  };
}

export class EventSubscriber {
  constructor(private readonly events: Event[]) {}

  subscribe(stepId: string) {
    return this.events.filter(
      (event) =>
        event.event_type === 'step_result' &&
        event.event_data.step_id === stepId
    );
  }
}
