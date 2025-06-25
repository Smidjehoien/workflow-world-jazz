import { FatalError, STATE, STEP_INDEX } from './global';

/**
 * Generates a "step wrapper" function that can be used to invoke a step
 * from a workflow.
 *
 * If the step has already been run, the result is returned immediately.
 * Otherwise, an error is thrown to notify the orchestrator that the step
 * has not been run yet.
 *
 * @param stepId - The ID of the step to invoke.
 * @returns A function that can be used to invoke the step.
 */
export function useStep<Args extends unknown[], Result>(stepId: string) {
  return async (...args: Args): Promise<Result> => {
    const stepIndex = globalThis[STEP_INDEX]++;
    const event = globalThis[STATE][stepIndex];
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
      // Notify orchestrator that this step has not been run
      throw Response.json(
        {
          stepId,
          arguments: args,
        },
        { status: 409 }
      );
    }
  };
}
