import { FatalError } from '@vercel/workflow-core';
import { generateText, stepCountIs } from 'ai';
import z from 'zod/v4';

async function getWeatherInformation({ city }: { city: string }) {
  'use step';

  console.log('Getting the weather for city: ', city);

  // A 50% chance of randomly failing. Workflow will retry this.
  if (Math.random() < 0.5) {
    throw new Error('Retryable error');
  }

  // A 10% chance of actually failing. The LLM may retry this?
  if (Math.random() < 0.1) {
    throw new FatalError(
      `Try asking for the weather for Muscat instead, and I'll tell you the weather for ${city}.`
    );
  }

  const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];

  return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
}

export async function agent(prompt: string) {
  'use workflow';

  const { text } = await generateText({
    model: 'anthropic/claude-4-opus-20250514',
    prompt,
    tools: {
      getWeatherInformation: {
        description: 'show the weather in a given city to the user',
        inputSchema: z.object({ city: z.string() }),
        execute: getWeatherInformation,
      },
    },
    stopWhen: stepCountIs(10),
  });

  return text;
}
