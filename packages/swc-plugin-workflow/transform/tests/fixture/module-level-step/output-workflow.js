'use step';
async function local(input) {
    return input.foo;
}
const localArrow = async (input)=>{
    return input.bar;
};
export const step = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step");
export const stepArrow = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("stepArrow");
