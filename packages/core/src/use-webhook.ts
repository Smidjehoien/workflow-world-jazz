export interface Webhook {
  url: string;
  then: Promise<Request>['then'];
  [Symbol.asyncIterator](): AsyncIterableIterator<Request>;
}

export type Method =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'OPTIONS'
  | 'HEAD';

export interface WebhookOptions {
  /**
   * The HTTP method (or methods) that are allowed to be used to trigger the webhook.
   *
   * By default, only `POST` is allowed.
   */
  method?: Method | Method[];
}

/**
 * Creates an ephemeral webhook URL that can be provided to external systems
 * outside of the workflow run (such as send in an email for human-in-the-loop
 * workflows).
 *
 * @param options - Configuration options for the webhook.
 * @returns A `Webhook` that can awaited on to receive `Request` instances. Can be awaited multiple times, or used in a `for await` loop.
 */
export function useWebhook(options?: WebhookOptions): Webhook {
  throw new Error('Webhooks are not supported outside of workflow functions');
}
