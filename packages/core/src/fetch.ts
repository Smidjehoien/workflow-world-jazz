/**
 * A hoisted `fetch()` function that is executed as a "step" function,
 * for use within workflow functions.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 */
export async function fetch(...args: Parameters<typeof globalThis.fetch>) {
  'use step';
  return globalThis.fetch(...args);
}
