# Workflow directives specification

## The 'use step' directive

The use step directive works similarly to the 'use server' in react. A function marked at 'use step' will be bundled and executed on the server

When calling a Server Function on the client, it will make a network request to enqueue the step on the Vercel queue, along with a serialized copy of any arguments passed. The result of the calling the server function will be an object containing the message ID of the enqueued message, not the actual return value of the function.

The logic to encapsulate enqueueing a step lives in the `useStep` function in '@vercel/workflow-core'. So, the compiler transform to call a step simply looks like this:

Input code
```
// index.ts
async function add(a, b) {
  "use step";
  return a + b
}

add(1, 2)

```

Output code
```
// api/steps/add.ts
import { handleStep } from '@vercel/workflow-core';

async function add(a, b) {
  return a + b
}

export const POST = handleStep(add);

// index.ts
import { useStep } from '@vercel/workflow-core/dist/step';

useStep('add')(1, 2)
```

Instead of individually marking functions with 'use server', you can add the directive to the top of a file to mark all exports within that file as Step Functions that can be used anywhere.


### Caveats 
* 'use step' must be at the very beginning of their function or module; above any other code including imports (comments above directives are OK). They must be written with single or double quotes, not backticks.
* The arguments and return value of 'use step' must be serializable.
* Because the underlying network calls are always asynchronous, 'use step' can only be used on async functions.
