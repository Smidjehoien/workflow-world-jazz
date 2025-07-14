// Error: sync function with use step
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
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("validStep")();
}
export const validWorkflow = async ()=>{
    return 'test';
};
