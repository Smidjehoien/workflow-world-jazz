import jwt from 'jsonwebtoken';
import type { Event } from '../backend.js';
import { EventConsumerResult } from '../events-consumer.js';
import { StepsNotRunError } from '../global.js';
import type { WorkflowOrchestratorContext } from '../private.js';
import type { WebhookTokenPayload } from '../schemas.js';
import { hydrateStepReturnValue } from '../serialization.js';
import type { Webhook, WebhookOptions } from '../use-webhook.js';
import { type PromiseWithResolvers, withResolvers } from '../util.js';

export function createUseWebhook(ctx: WorkflowOrchestratorContext) {
  return function useWebhook(options: WebhookOptions = {}): Webhook {
    const secret = process.env.WORKFLOW_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error(
        '`WORKFLOW_WEBHOOK_SECRET` environment variable is not set'
      );
    }
    const { url, workflowRunId, workflowName } = ctx;

    const webhookUrl = new URL(`/api/webhook`, url);

    // Deterministically generated webhook ID for this webhook
    const webhookId = ctx.globalThis.crypto.randomUUID();

    const payload: WebhookTokenPayload & { iat: number } = {
      method: options.method,
      workflowRunId,
      webhookId,
      workflowName,

      // Generate a deterministic "issued at" timestamp based
      // on the current fixed timestamp of the workflow run
      iat: Math.floor(ctx.globalThis.Date.now() / 1000),
    };
    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

    webhookUrl.searchParams.set('token', token);

    // Queue of webhook events that have been received but not yet processed
    const requestsQueue: Event[] = [];

    // Queue of promises that resolve to the next webhook request
    const promises: PromiseWithResolvers<Request>[] = [];

    let eventLogEmpty = false;

    ctx.eventsConsumer.subscribe((event) => {
      // If there are no events and there are promises waiting,
      // it means the webhook has been awaited, but an incoming request has not yet been received on the webhook URL.
      // In this case, the workflow should be suspended until the webhook is called.
      if (!event) {
        eventLogEmpty = true;

        if (promises.length > 0) {
          setTimeout(() => {
            ctx.onWorkflowError(
              new StepsNotRunError(ctx.invocationsQueue, ctx.globalThis)
            );
          }, 0);
          return EventConsumerResult.Finished;
        }
      }

      if (
        event?.event_type === 'webhook_request' &&
        event.event_data.webhook_id === webhookId
      ) {
        if (promises.length > 0) {
          const next = promises.shift();
          if (next) {
            // Reconstruct the Request object from the event data
            const request = hydrateStepReturnValue(
              event.event_data.request,
              ctx.globalThis
            );
            next.resolve(request);
          }
        } else {
          requestsQueue.push(event);
        }

        return EventConsumerResult.Consumed;
      }

      return EventConsumerResult.NotConsumed;
    });

    // Helper function to create a new promise that waits for the next webhook call
    function createWebhookPromise(): Promise<Request> {
      const resolvers = withResolvers<Request>();
      if (requestsQueue.length > 0) {
        const nextRequest = requestsQueue.shift();
        if (nextRequest) {
          const request = hydrateStepReturnValue(
            nextRequest.event_data.request,
            ctx.globalThis
          );
          resolvers.resolve(request);
          return resolvers.promise;
        }
      }

      if (eventLogEmpty) {
        // If the event log is already empty then we know the webhook will not be resolved.
        // Treat this case as a "step not run" scenario and suspend the workflow.
        setTimeout(() => {
          ctx.onWorkflowError(
            new StepsNotRunError(ctx.invocationsQueue, ctx.globalThis)
          );
        }, 0);
      }

      promises.push(resolvers);

      return resolvers.promise;
    }

    const webhook: Webhook = {
      url: webhookUrl.href,

      // biome-ignore lint/suspicious/noThenProperty: Intentionally thenable
      then<TResult1 = Request, TResult2 = never>(
        onfulfilled?:
          | ((value: Request) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
      ): Promise<TResult1 | TResult2> {
        return createWebhookPromise().then(onfulfilled, onrejected);
      },

      // Support `for await (const req of webhook) { … }` syntax
      async *[Symbol.asyncIterator]() {
        while (true) {
          yield await this;
        }
      },
    };

    return webhook;
  };
}
