import { start as __private_workflow_start } from "@vercel/workflow-core";
export const processData = async (data)=>__private_workflow_start("processData", {
        arguments: [
            data
        ]
    });
