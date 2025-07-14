export async function badStep() {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("badStep")();
}
export const badWorkflow = async ()=>{
    console.log('hello');
    // Error: directive must be at the top of function
    'use workflow';
    return true;
};
