import { start as __private_workflow_start } from "@vercel/workflow-core/runtime";
export const processData = async (data)=>__private_workflow_start("processData", [
        data
    ]);
