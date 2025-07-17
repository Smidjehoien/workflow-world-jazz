// Error: sync function with use step
import { start as __private_workflow_start, runStep as __private_run_step } from "@vercel/workflow-core/runtime";
export function syncStep() {
    'use step';
    return 42;
}
// Error: sync arrow function with use workflow
export const syncWorkflow = ()=>{
    'use workflow';
    return 'test';
};
// Error: sync method with use step
const obj = {
    syncMethod () {
        'use step';
        return true;
    }
};
// These are ok
export async function validStep() {
    return __private_run_step("validStep", {
        arguments: []
    });
}
export const validWorkflow = async ()=>__private_workflow_start("validWorkflow", []);
