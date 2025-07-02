/**
 * Utils used by the bundler when transforming code
 */
const registeredSteps = new Map();
/**
 * Register a step function to be served in the server bundle
 */
export function registerStepFunction(stepFn) {
    registeredSteps.set(stepFn.name, stepFn);
}
/**
 * Find a registered step function by name
 */
export function getStepFunction(stepName) {
    return registeredSteps.get(stepName);
}
// TODO: add support for binary data and streams using @vercel/queue
// | ArrayBuffer;
//# sourceMappingURL=private.js.map