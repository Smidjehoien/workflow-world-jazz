import { resumeHook } from '@vercel/workflow/api';

export const POST = async (request: Request) => {
  const { token, data } = await request.json();
  const run = await resumeHook(token, data);
  return Response.json(run, { status: run ? 200 : 404 });
};
