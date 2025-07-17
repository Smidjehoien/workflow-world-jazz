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
  console.log('stepAdd', { a, b });
  return a + b;
}
