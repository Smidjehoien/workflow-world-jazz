export const stepFunction = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("stepFunction");
export async function workflowFunction(a, b) {
    return stepFunction(a, b);
}
export async function normalFunction(a, b) {
    return a * b;
}
