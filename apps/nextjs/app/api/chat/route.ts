import type { UIMessage } from 'ai';
import { createAIWorkflowResponse } from '@/util/workflow';
import { chat } from '@/workflows/chat';
// TODO: remove these once example app is updated to import
// workflows with start()
import '../../../../example/workflows/99_e2e';

// So the response stream doesn't timeout
export const maxDuration = 800;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const { response, writable } = await createAIWorkflowResponse(messages);

  const workflowHandle = await chat(messages, writable);
  console.log('Started workflow', workflowHandle);

  return response;
}
