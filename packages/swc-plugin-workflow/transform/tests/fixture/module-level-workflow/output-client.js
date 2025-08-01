import { start as __private_workflow_start } from "@vercel/workflow-core/runtime";
const localArrow = async (input)=>{
    return input.bar;
};
export async function workflow(input) {
    return __private_workflow_start("workflow", [
        input
    ]);
}
export const arrowWorkflow = async (input)=>__private_workflow_start("arrowWorkflow", [
        input
    ]);
