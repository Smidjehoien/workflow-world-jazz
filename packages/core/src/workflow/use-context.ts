import type { WorkflowContext } from '../use-context.js';

export const WORKFLOW_CONTEXT_SYMBOL =
  /* @__PURE__ */ Symbol.for('WORKFLOW_CONTEXT');

export function useContext(): WorkflowContext {
  // Inside the workflow VM, the context is stored in the globalThis object behind a symbol
  const ctx = (globalThis as any)[WORKFLOW_CONTEXT_SYMBOL] as WorkflowContext;
  if (!ctx) {
    throw new Error(
      '`useContext()` can only be called inside a workflow or step function'
    );
  }
  return ctx;
}
