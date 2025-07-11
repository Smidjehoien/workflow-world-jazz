import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const openai = createOpenAI({
  // @ts-expect-error - TODO: setup tsconfig
  apiKey: process.env.PRANAY_PERSONAL_OPENAI_KEY,
});

export async function ai(prompt: string) {
  'use workflow';
  const { text } = await generateText({
    model: openai('o3-mini'),
    prompt,
  });

  return text;
}
