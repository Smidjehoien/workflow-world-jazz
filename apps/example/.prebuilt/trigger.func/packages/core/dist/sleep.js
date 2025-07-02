/**
 * Sleep within a workflow for a given duration.
 *
 * @param duration - The duration to sleep for. This is a string in the format
 * of `"1000ms"`, `"1s"`, `"1m"`, `"1h"`, or `"1d"`.
 * @returns A promise that resolves when the sleep is complete.
 */
export const sleep = 
// @ts-expect-error - Meant to be used within a workflow file - will evaluate to undefined outside of the workflow VM context
globalThis[Symbol.for('WORKFLOW_USE_STEP')]?.('__builtin_sleep');
//# sourceMappingURL=sleep.js.map