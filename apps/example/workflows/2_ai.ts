import { generateText } from 'ai';

// TODO: fix the deadcode/treeshaking elimination issue then remove this
export async function dummy_step(prompt: string) {
  'use step';
  // to prevent dead code elimination (otherwise generateText doesn't get
  // registered) in the steps bundle
  generateText;
}

export async function ai(prompt: string) {
  'use workflow';
  console.log(globalThis[Symbol.for('@vercel/request-context')]);

  const { text } = await generateText({
    model: 'openai/o3',
    prompt,
  });

  return text;
}
