/**
 * Utils used by the bundler when transforming code
 */

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
  console.log('getStepFunction', stepName, registeredSteps);
  return registeredSteps.get(stepName);
}

/**
 * A serializable value:
 * Any valid JSON object is serializable
 *
 * @example ```ts
 * // any valid JSON object is serializable
 * const anyJson: Serializable = { foo: "bar" };
 *
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
// | ArrayBuffer; // TODO:
