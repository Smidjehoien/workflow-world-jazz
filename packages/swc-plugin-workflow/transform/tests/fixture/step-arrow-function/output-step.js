import { registerStepFunction } from "@vercel/workflow-core/private";
export const multiply = async (a, b)=>{
    return a * b;
};
registerStepFunction(multiply);
