export async function add(a, b) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add")(a, b);
}
