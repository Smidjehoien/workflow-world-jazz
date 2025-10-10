import { resumeHook } from '@vercel/workflow/api';

export const POST = async (request: Request) => {
  const { token, data } = await request.json();
  const hook = await resumeHook(token, data);
  return Response.json(hook, { status: hook ? 200 : 404 });
};
