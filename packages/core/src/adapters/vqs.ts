import { handleCallback, send } from '@vercel/queue';
import { MessageId, ValidQueueName, type World } from '../world.js';

export function createVqs(): World {
  const queue: World['queue'] = async (queueName, x) => {
    const { messageId } = await send(queueName, x);
    return { messageId: MessageId.parse(messageId) };
  };

  const createQueueHandler: World['createQueueHandler'] = (prefix, handler) => {
    return handleCallback({
      [`${prefix}*`]: {
        default: (body, meta) => {
          return handler(body, {
            queueName: ValidQueueName.parse(meta.topicName),
            messageId: MessageId.parse(meta.messageId),
            attempt: meta.deliveryCount,
          });
        },
      },
    });
  };

  const getDeploymentId: World['getDeploymentId'] = async () => {
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
    if (!deploymentId) {
      throw new Error('VERCEL_DEPLOYMENT_ID environment variable is not set');
    }
    return deploymentId;
  };

  return { queue, createQueueHandler, getDeploymentId };
}
