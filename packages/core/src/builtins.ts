/**
 * A hoisted fetch step that's automatically available to workflows.
 */
export async function __builtin_fetch(...args: Parameters<typeof fetch>) {
  'use step';
  return fetch(...args);
}

export async function __builtin_response_json(res: Response) {
  'use step';
  return res.json();
}

export async function __builtin_response_text(res: Response) {
  'use step';
  return res.text();
}
