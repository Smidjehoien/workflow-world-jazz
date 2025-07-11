import { start as __private_workflow_start, runStep as __private_run_step } from "@vercel/workflow-core/runtime";
export async function stepFunction(a, b) {
    return __private_run_step("stepFunction", {
        arguments: [
            a,
            b
        ]
    });
}
export async function workflowFunction(a, b) {
    return __private_workflow_start("workflowFunction", {
        arguments: [
            a,
            b
        ]
    });
}
export async function normalFunction(a, b) {
    return a * b;
}
