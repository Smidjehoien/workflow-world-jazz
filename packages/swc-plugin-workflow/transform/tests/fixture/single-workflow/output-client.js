import { start as __private_workflow_start } from "@vercel/workflow-core/runtime";
export async function workflow(a, b) {
    return __private_workflow_start("workflow", [
        a,
        b
    ]);
}
