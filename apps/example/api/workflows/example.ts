import { handleWorkflow } from 'workflow';

export const POST = handleWorkflow(
  `
// api/_/global.ts
var STATE = Symbol.for("STATE");
var STEP_INDEX = Symbol.for("STEP_INDEX");
var FatalError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
};

// api/_/step.ts
function useStep(stepId) {
  return async (...args) => {
    const stepIndex = globalThis[STEP_INDEX]++;
    const event = globalThis[STATE][stepIndex];
    if (event) {
      if (event.error) {
        if (event.fatal) {
          throw new FatalError(event.error);
        }
        throw new Error(event.error);
      } else {
        return event.result;
      }
    } else {
      throw Response.json(
        {
          stepId,
          arguments: args
        },
        { status: 409 }
      );
    }
  };
}

// api/_/steps.ts
var add = useStep("add");

// workflows/workflows.ts
async function workflow(i) {
  "use workflow";
  const a = await add(i, 7);
  const b = await add(a, 8);
  return b;
}
export {
  workflow
};
  `,
  'wflow'
);
