import type { Hook, HookOptions } from '../create-hook.js';
import { WORKFLOW_CREATE_HOOK } from '../symbols.js';

export function createHook<T = any>(options?: HookOptions): Hook<T> {
  // Inside the workflow VM, the hook function is stored in the globalThis object behind a symbol
  const createHookFn = (globalThis as any)[
    WORKFLOW_CREATE_HOOK
  ] as typeof createHook;
  if (!createHookFn) {
    throw new Error(
      '`createHook()` can only be called inside a workflow function'
    );
  }
  return createHookFn(options);
}
