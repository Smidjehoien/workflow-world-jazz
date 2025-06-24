import { FatalError } from "./_/global";

// user step code
async function add(a: number, b: number): Promise<number> {
  if (Math.random() < 0.5) {
    throw new Error("Retryable error");
  }
  if (Math.random() < 0.2) {
    throw new FatalError("We're cooked yo!");
  }
  return a + b;
}

// step invoke wrapper code
export async function POST(req: Request) {
  const { arguments: args } = await req.json();
  try {
    const result = await add(...args);
    return Response.json({ result });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json(
      {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        fatal: err instanceof FatalError ? true : undefined,
      },
      { status: 500 }
    );
  }
}
