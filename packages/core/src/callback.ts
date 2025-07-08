import {
  handleCallback,
  type MessageHandler,
  type MessageMetadata,
} from '@vercel/queue';

type CallbackHandlers = Parameters<typeof handleCallback>[0];

export function createHandlersCatchAll(
  topicPrefix: string,
  handler: (
    message: unknown,
    metadata: MessageMetadata & { topicName: string; consumerGroupName: string }
  ) => ReturnType<MessageHandler>
): CallbackHandlers {
  const handlers = new Proxy({} as CallbackHandlers, {
    get(target, prop) {
      if (typeof prop === 'string' && prop.startsWith(topicPrefix)) {
        return {
          default: (message: unknown, metadata: MessageMetadata) => {
            return handler(message, {
              ...metadata,
              topicName: prop,
              consumerGroupName: 'default',
            });
          },
        };
      }
      return Reflect.get(target, prop);
    },
  });
  return handlers;
}

export const handleCallbackCatchAll = (
  topicPrefix: string,
  handler: (
    message: unknown,
    metadata: MessageMetadata & { topicName: string; consumerGroupName: string }
  ) => ReturnType<MessageHandler>
) => {
  return handleCallback(createHandlersCatchAll(topicPrefix, handler));
};
