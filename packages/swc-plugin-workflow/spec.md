# Workflow directives specification

## The 'use step' directive

The use step directive works similarly to the 'use server' in react. A function marked at 'use step' will be bundled and executed on the server.

The swc plugin has 2 modes - 'server' mode and 'workflow' mode.

### Server Mode

When executed in 'server' mode, each step is kept as is and is simply registered using `registerStepFunction` from `@vercel/workflow-core`. For example:

Input code:
```
// workflow/steps.js
export async function add(a, b) {
  "use step";
  return a + b
}
```

Server output code
```
// api/generated/steps.js
import { registerStepFunction } from "@vercel/workflow-core/private"

export async function add(a, b) {
  return a + b
}
registerStepFunction(add)
```

Upstream, this plugin will be used in server mode by a bundler to combine multiple entry points and create a server bundle that's stored at `api/generated/steps.ts`

### Workflow Mode

When executed in 'workflow' mode, step definitions are replaced with a `useStep` call from `@vercel/workflow-core`. `useStep` will handle the logic to resolve the step invoke result from cache, or making network request to enqueue the step on Vercel queue with a serialized copy of any arguments passed. 


Input code
```
// workflow/steps.js
export async function add(a, b) {
  "use step";
  return a + b
}
```

Output code
```
// workflow/generated/steps.js
import { useStep } from '@vercel/workflow-core';

export const add = useStep('add')
```

Instead of individually marking functions with 'use step', you can also add the directive to the top of a file to mark all exports within that file as step functions


### Caveats 
* 'use step' must be at the very beginning of their function or module; above any other code including imports (comments above directives are OK). They must be written with single or double quotes, not backticks.
* The arguments and return value of 'use step' must be serializable.
* Because the underlying network calls are always asynchronous, 'use step' can only be used on async functions.
