// This is the entrypoint for the Vercel API route. It's responsible for
// invoking the step/workflows and returning the result.
//
// It gets bundled along with the tasks/workflows and will have access to a
// manifest of all the tasks/workflows it can access.

export async function POST(req: Request): Promise<Response> {
  // worker
  return Response.json({ ping: 'pong' });
}

export async function GET(req: Request): Promise<Response> {
  // dev UI?
  return new Response('Hello, world!');
}
