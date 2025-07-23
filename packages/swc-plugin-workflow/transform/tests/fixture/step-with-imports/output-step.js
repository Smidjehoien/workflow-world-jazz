import { registerStepFunction } from "@vercel/workflow-core/private";
import { someHelper } from './helpers'; // should be removed
import { anotherHelper, usefulHelper// do not remove
 } from './utils';
import defaultExport from './default'; // should be removed
import * as something from './something'; // should be removed
import * as useful from './useful'; // do not remove
import 'dotenv/config'; // should be removed
export async function processData(data) {
    const result = someHelper(data);
    const transformed = anotherHelper(result);
    something.doSomething();
    return defaultExport(transformed);
}
export function normalFunction() {
    useful.doSomething();
    return usefulHelper();
}
registerStepFunction(processData);
