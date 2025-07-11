/**
 * A hoisted fetch step that's automatically available to workflows.
 */
export async function __builtin_fetch(...args: Parameters<typeof fetch>) {
  'use step';
  return fetch(...args);
}
