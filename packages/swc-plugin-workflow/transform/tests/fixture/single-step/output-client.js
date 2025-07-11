import { runStep as __private_run_step } from "@vercel/workflow-core/runtime";
export async function add(a, b) {
    return __private_run_step("add", {
        arguments: [
            a,
            b
        ]
    });
}
