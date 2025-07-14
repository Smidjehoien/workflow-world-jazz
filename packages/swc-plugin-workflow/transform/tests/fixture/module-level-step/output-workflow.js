'use step';
async function local(input) {
    return input.foo;
}
const localArrow = async (input)=>{
    return input.bar;
};
export async function step(input) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step")(input);
}
export const stepArrow = async (input)=>globalThis[Symbol.for("WORKFLOW_USE_STEP")]("stepArrow")(input);
