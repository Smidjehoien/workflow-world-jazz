// Error: Can't have both directives in the same file
'use step';
'use workflow';
export async function test() {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("test")();
}
