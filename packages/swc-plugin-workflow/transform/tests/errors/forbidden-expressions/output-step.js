import { registerStepFunction } from "@vercel/workflow-core/private";
export async function stepWithThis() {
    // Error: this is not allowed
    return this.value;
}
export async function stepWithArguments() {
    // Error: arguments is not allowed
    return arguments[0];
}
class TestClass extends BaseClass {
    async stepMethod() {
        'use step';
        // Error: super is not allowed
        return super.method();
    }
}
registerStepFunction(stepWithThis);
registerStepFunction(stepWithArguments);
