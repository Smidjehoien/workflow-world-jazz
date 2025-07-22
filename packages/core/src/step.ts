import { waitUntil } from '@vercel/functions';
import { EventConsumerResult, type EventsConsumer } from './events-consumer.js';
import { FatalError, StepsNotRunError } from './global.js';
import type { Serializable } from './schemas.js';
import { hydrateStepReturnValue } from './serialization.js';

export interface WorkflowContext {
  globalThis: typeof globalThis;
  eventsConsumer: EventsConsumer;
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
      const invocationId = ctx.randomUUID();
      let gotStepStarted = false;
      ctx.invocationsQueue.push({ stepName, args, invocationId });

      return new Promise((resolve, reject) => {
        ctx.eventsConsumer.subscribe((event) => {
          if (!event) {
            // We've reached the end of the events, so this step has either not been run or currently running.
            // Crucially, if we got here, then this step Promise does
            // not resolve so that the user workflow code does not proceed any further.
            if (!gotStepStarted) {
              // Notify workflow handler that this step has not been run.
              ctx.onWorkflowError(
                new StepsNotRunError(ctx.invocationsQueue, ctx.globalThis)
              );
            }
            return EventConsumerResult.NotConsumed;
          }

          if (event.event_data.invocation_id !== invocationId) {
            // We're not interested in this event - the invocationId belongs to a different step
            return EventConsumerResult.NotConsumed;
          }

          if (event.event_type === 'step_started') {
            // Step has started - so remove from the invocations queue
            const invocationsQueueIndex = ctx.invocationsQueue.findIndex(
              (invocation) => invocation.invocationId === invocationId
            );
            if (invocationsQueueIndex !== -1) {
              ctx.invocationsQueue.splice(invocationsQueueIndex, 1);
            } else {
              console.warn(
                `Step ${stepName} started but not found in invocations queue (should not happen)`
              );
            }
            gotStepStarted = true;
            return EventConsumerResult.Consumed;
          }

          if (event.event_type === 'step_failed') {
            // Step failed - bubble up to workflow
            if (event.event_data.fatal) {
              reject(new FatalError(event.event_data.error));
            } else {
              // This is a retryable error, so nothing to do here,
              // but we will consume the event
              return EventConsumerResult.Consumed;
            }
          } else if (event.event_type === 'step_result') {
            // Step has already completed, so resolve the Promise with the cached result
            const ops: Promise<void>[] = [];
            const hydratedResult = hydrateStepReturnValue(
              event.event_data.result,
              ops,
              ctx.globalThis
            );
            waitUntil(Promise.all(ops));
            resolve(hydratedResult);
          } else {
            // An unexpected event type has been received, but it does belong to this step (matching `invocationId`)
            reject(
              new FatalError(`Unexpected event type: "${event.event_type}"`)
            );
          }

          return EventConsumerResult.Finished;
        });
      });
    };
  };
}
