export async function stepWithThis() {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("stepWithThis")();
}
export async function stepWithArguments() {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("stepWithArguments")();
}
class TestClass extends BaseClass {
    async stepMethod() {
        'use step';
        // Error: super is not allowed
        return super.method();
    }
}
