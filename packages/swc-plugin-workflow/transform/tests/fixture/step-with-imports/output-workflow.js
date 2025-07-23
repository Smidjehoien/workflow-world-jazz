import { usefulHelper// do not remove
 } from './utils';
import * as useful from './useful'; // do not remove
export async function processData(data) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("processData")(data);
}
export function normalFunction() {
    useful.doSomething();
    return usefulHelper();
}
