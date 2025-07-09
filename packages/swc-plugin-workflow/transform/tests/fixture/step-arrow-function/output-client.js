import { runStep as __private_run_step } from "@vercel/workflow-core";

export const multiply = async (a, b)=>__private_run_step("multiply", {
        arguments: [
            a,
            b
        ]
    });
