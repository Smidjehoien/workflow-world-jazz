/**
 * Utils used by the bundler when transforming code
 */

import {
  InvalidCallbackError,
  parseCallbackRequest,
  QueueClient,
  Topic,
} from '@vercel/queue';
import { _handleStep, type StepFunction } from '.';

const registeredSteps = new Map<string, StepFunction>();

/**
 * Register a step function to be served in the server bundle
 */
export async function registerStepFunction(stepFn: StepFunction) {
  registeredSteps.set(stepFn.name, stepFn);
}

/**
 * HACK!
 * A single main route that handles any step execution request and routes
 * to the appropriate step function.
 * We should create different bundles for each step, this is temporary.
 */
export function handleSteps() {
  return async (request: Request): Promise<Response> => {
    try {
      // Parse the queue callback information
      const { queueName, consumerGroup, messageId } =
        parseCallbackRequest(request);

      // Ensure we're handling a `step` topic
      if (!queueName.startsWith('step-')) {
        throw new Error(`Expected 'step-*' topic, got '${queueName}'`);
      }

      // Ensure the consumer group is 'default'
      if (consumerGroup !== 'default') {
        throw new Error(
          `Expected 'default' consumer group, got '${consumerGroup}'`
        );
      }

      // extract the step name from the queue name
      const stepName = queueName.slice(5);
      const stepFn = registeredSteps.get(stepName);
      if (!stepFn) {
        throw new Error(`Step ${stepName} not found`);
      }

      // Create client and process the message
      const client = new QueueClient();
      const topic = new Topic(client, queueName);
      const cg = topic.consumerGroup(consumerGroup);

      await cg.consume(_handleStep(stepFn), { messageId });

      return Response.json({ status: 'success' });
    } catch (error) {
      console.error('Callback error:', error);

      if (error instanceof InvalidCallbackError) {
        return Response.json(
          { error: 'Invalid callback request' },
          { status: 400 }
        );
      }

      return Response.json(
        { error: 'Failed to process callback' },
        { status: 500 }
      );
    }
  };
}
