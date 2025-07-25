import { AsyncLocalStorage } from 'node:async_hooks';

export const contextStorage = new AsyncLocalStorage();

/**
 * This is the step function implementation of `useContext`.
 * It uses `AsyncLocalStorage` to store the context and
 * retrieve it in the step function.
 */
export function useContext() {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error(
      '`useContext()` can only be called inside a workflow or step function'
    );
  }
  return ctx;
}
