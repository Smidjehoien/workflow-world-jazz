import { generateText } from 'ai';

export async function ai(prompt: string) {
  'use workflow';
  console.log(globalThis[Symbol.for('@vercel/request-context')]);

  const { text } = await generateText({
    model: 'openai/o3',
    prompt,
  });

  return text;
}
