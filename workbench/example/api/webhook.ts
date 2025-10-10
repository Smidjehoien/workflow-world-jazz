import { resumeHook, resumeWebhook } from '@vercel/workflow/api';

export const POST = async (request: Request) => {
  const { token, data } = await request.json();
  const hook = await resumeHook(token, data);
  return Response.json(hook, { status: hook ? 200 : 404 });
};

export const PUT = async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }
  const res = await resumeWebhook(token, request);
  return res ?? new Response('Webhook not found', { status: 404 });
};
