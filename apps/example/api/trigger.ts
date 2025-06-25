import {} from 'workflow';

export const POST = async (req: Request) => {
  const { payload } = await req.json();

  return new Response(JSON.stringify({ payload }));
};
