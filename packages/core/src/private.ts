/**
 * Utils used by the bundler when transforming code
 */

import type { Serializable } from './schemas.js';

export type StepFunction<
  Args extends Serializable[] = any[],
  Result extends Serializable | unknown = unknown,
> = ((...args: Args) => Promise<Result>) & {
  maxRetries?: number;
};

const registeredSteps = new Map<string, StepFunction>();

/**
 * Register a step function to be served in the server bundle
 */
export function registerStepFunction(stepFn: StepFunction) {
  registeredSteps.set(stepFn.name, stepFn);
}

/**
 * Find a registered step function by name
 */
export function getStepFunction(stepName: string): StepFunction | undefined {
  return registeredSteps.get(stepName);
}
