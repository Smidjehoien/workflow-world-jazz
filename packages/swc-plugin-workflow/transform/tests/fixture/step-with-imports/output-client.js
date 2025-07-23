import { runStep as __private_run_step } from "@vercel/workflow-core/runtime";
import { usefulHelper// do not remove
 } from './utils';
import * as useful from './useful'; // do not remove
export async function processData(data) {
    return __private_run_step("processData", {
        arguments: [
            data
        ]
    });
}
export function normalFunction() {
    useful.doSomething();
    return usefulHelper();
}
