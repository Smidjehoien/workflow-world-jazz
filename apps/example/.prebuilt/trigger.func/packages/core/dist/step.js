import { FatalError, STATE, STEP_INDEX, StepNotRunError } from './global.js';
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
export function useStep(stepId, context = globalThis) {
    return async (...args) => {
        const stepIndex = context[STEP_INDEX];
        if (typeof stepIndex !== 'number') {
            throw new Error('Invalid context: `useStep` must be called from a within a workflow execution environment');
        }
        else {
            // Increment the step index for the next invocation
            context[STEP_INDEX]++;
        }
        const event = context[STATE][stepIndex];
        if (event) {
            if (event.error) {
                // Step failed - bubble up to workflow
                if (event.fatal) {
                    throw new FatalError(event.error);
                }
                throw new Error(event.error);
            }
            else {
                // Step has already completed
                return event.result;
            }
        }
        else {
            // Notify workflow dispatcher that this step has not been run
            throw new StepNotRunError(stepId, args);
        }
    };
}
export function createUseStep(ctx) {
    return function useStep(stepId) {
        return (...args) => {
            const stepIndex = ctx.stepIndex++;
            const event = ctx.state[stepIndex];
            ctx.invocationsQueue.push({ stepId, args });
            return new Promise((resolve, reject) => {
                if (event) {
                    if ('error' in event) {
                        // Step failed - bubble up to workflow
                        if (event.fatal) {
                            return reject(new FatalError(event.error));
                        }
                        return reject(new Error(event.error));
                    }
                    else {
                        // Step has already completed
                        return resolve(event.result);
                    }
                }
                else {
                    // Notify workflow handler that this step has not been run.
                    // Crucially, this step Promise does not resolve so that the user
                    // workflow code does not proceed any further.
                    ctx.onWorkflowError(new StepNotRunError(stepId, args));
                }
            });
        };
    };
}
//# sourceMappingURL=step.js.map