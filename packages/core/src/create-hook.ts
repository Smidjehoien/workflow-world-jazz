export interface Hook<T = any> {
  /**
   * The token used to identify this hook.
   */
  token: string;
  then: Promise<T>['then'];
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface HookOptions {
  /**
   * Unique token that is used to associate with the hook.
   *
   * When specifying an explicit token, the token should be constructed
   * with information that the dispatching side can reliably reconstruct
   * the token with the information it has available.
   *
   * If not provided, a randomly generated token will be assigned.
   *
   * @example
   *
   * ```ts
   * // Explicit token for a Slack bot (one workflow run per channel)
   * const hook = createHook<SlackMessage>({
   *   token: `slack_webhook:${channelId}`,
   * });
   * ```
   */
  token?: string;
}

/**
 * Creates a hook that can be used to suspend and resume the workflow run with a payload.
 *
 * Hooks allow external systems to send arbitrary serializable data into a workflow.
 *
 * Unlike {@link createWebhook | webhooks}, hooks don't have built-in HTTP handling
 * and must be explicitly resumed via an API route or other mechanism.
 *
 * @param options - Configuration options for the hook.
 * @returns A `Hook` that can be awaited to receive one or more payloads.
 *
 * @example
 *
 * ```ts
 * export async function workflowWithHook() {
 *   "use workflow";
 *
 *   const hook = createHook<{ message: string }>();
 *   console.log('Hook token:', hook.token);
 *
 *   const payload = await hook;
 *   console.log('Received:', payload.message);
 * }
 * ```
 */
// @ts-expect-error `options` is here for types/docs
export function createHook<T = any>(options?: HookOptions): Hook<T> {
  throw new Error(
    '`createHook()` can only be called inside a workflow function'
  );
}
