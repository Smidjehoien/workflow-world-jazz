// Error: Can't have both directives in the same file
import { registerStepFunction } from "@vercel/workflow-core/private";
'use workflow';
export async function test() {
    return 42;
}
registerStepFunction(test);
