import { someHelper } from './helpers'; // should be removed
import {
  anotherHelper, // should be removed
  usefulHelper // do not remove
} from './utils'; 
import defaultExport from './default'; // should be removed
import * as something from './something'; // should be removed
import * as useful from './useful'; // do not remove
import 'dotenv/config' // should be removed

export async function processData(data) {
  'use step';
  const result = someHelper(data);
  const transformed = anotherHelper(result);
  something.doSomething();
  return defaultExport(transformed);
}

export function normalFunction() {
  useful.doSomething();
  return usefulHelper();

} 