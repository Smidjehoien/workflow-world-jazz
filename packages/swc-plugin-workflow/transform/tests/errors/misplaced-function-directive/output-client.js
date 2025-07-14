import { runStep as __private_run_step } from "@vercel/workflow-core/runtime";
export async function badStep() {
    return __private_run_step("badStep", {
        arguments: []
    });
}
export const badWorkflow = async ()=>{
    console.log('hello');
    // Error: directive must be at the top of function
    'use workflow';
    return true;
};
