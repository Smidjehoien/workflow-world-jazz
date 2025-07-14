import { registerStepFunction } from "@vercel/workflow-core/private";
export async function add(a, b) {
    return a + b;
}
registerStepFunction(add);
