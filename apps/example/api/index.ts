import { STATE, STEP_INDEX } from "./_/global";
import { add } from "./_/steps";

// user code
async function wflow(i: number) {
  const a = await add(i, 7);
  const b = await add(a, 8);
  return b;
}

export async function POST(req: Request) {
  const body = await req.json();

  // Set up global state
  globalThis[STATE] = body.state;
  globalThis[STEP_INDEX] = 1;

  // Consume starting step
  const initialState = body.state[0];

  // Set up determinism
  Date.now = () => initialState.t;

  // Invoke user workflow
  try {
    const result = await wflow(...initialState.arguments);
    return Response.json({ result });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
