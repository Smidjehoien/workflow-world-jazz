import { generateText } from 'ai';

export const generateMessage = async (prompt: string) => {
  'use step';

  // Generate birthday message text using GPT-5-nano via AI Gateway
  const { text } = await generateText({
    model: 'openai/gpt-5-nano',
    prompt: `Create a heartfelt birthday message for a birthday card with this theme: ${prompt}`,
  });

  return text;
};
