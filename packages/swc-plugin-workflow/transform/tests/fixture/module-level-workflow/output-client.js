import { start as __private_workflow_start } from "@vercel/workflow-core";
async function local(input) {
    return input.foo;
}
const localArrow = async (input)=>{
    return input.bar;
};
export async function workflow(input) {
    return __private_workflow_start("workflow", {
        arguments: [
            input
        ]
    });
}
export const arrowWorkflow = async (input)=>__private_workflow_start("arrowWorkflow", {
        arguments: [
            input
        ]
    });
