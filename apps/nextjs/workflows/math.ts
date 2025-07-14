/**
 * Local version of add
 */
export function localAdd(a: number, b: number) {
  return a + b;
}

/**
 * Durable version of the add function
 */
export async function stepAdd(a: number, b: number) {
  'use step';
  return a + b;
}
