# Workflow SDK Concepts

## What is a "durable function"?

Workflows (i.e. _durable functions_) are a programming model for building long‑running,
stateful application logic on top of stateless compute.

Instead of holding memory
or threads open, the runtime persists progress as an event log and
deterministically replays your code to reconstruct in‑memory state after
cold starts, failures, or scale events.

This lets you write ordinary async code (awaits, loops, error handling)
while the platform provides reliable timers, retries, idempotency, and
external resumption (via webhooks).

The result is resilient function execution that can span minutes to months
(or even forever) with strong operational guarantees.

## Core concepts

One of the primary goals of Workflow SDK is to make writing workflows
feel as natural as writing a Node.js script that you would run locally.

Thus, _workflows are regular JavaScript (or TypeScript) functions_.

However, there are two main concepts that are introduced when writing workflows:

 * __Workflow function__
 * __Step function__

### Workflow function

> Directive: `"use workflow"`

The outermost function of your workflow is the orchestrator of
your application logic, which consists of one or more
_step function invocations_.

Calling a step function looks like a normal function call, but
under the hood, the framework pauses execution of the workflow,
and queues the step to be executed separately.

When the step completes, the workflow resumes execution.

#### Rules of workflow functions

  - A workflow is a JS function with a few unique execution semantics. Conceptually
    it can be thought of as similar to writing a React component - it will be executed
    multiple times over the lifetime of the workflow.
  - This means workflow functions can not directly have side effects or non-deterministic
    behavior, since the code execution path must be guaranteed across runs.
  - Side effects, etc. must happen inside a step. The outputs of each step will get stored
    in the framework's event log and will be available during future workflow runs.
  - In practice, you should not need to worry too much about non-determinism, because
    workflow functions are executed inside a sandboxed environment (specially configured
    Node.js `vm` context) that prevents non-deterministic behaviors.
  - _However_, this means that workflow functions **do not** have full Node.js runtime access.

> [!TIP]
>
> Not having full Node.js access in your workflow function may
> sound limiting at first, but in practice you will find that the
> workflow function is merely an orchestrator of smaller pieces of
> logic (steps), and those steps _do_ have full Node.js access.
>
> So if you are tempted to use an npm package or Node.js API that
> is not compatible within the workflow execution environment -
> then break it out into a step function.

### Step function

> Directive: `"use step"`

Step functions are the implementations of the individual pieces of your workflow logic.

Contrary to workflow functions, step functions are executed with full access to the Node.js
runtime environment. They can therefore access all Node.js APIs and use any npm package.

Step functions have built-in retry semantics, so if an error is thrown by a step function,
the framework will retry until a max threshold is reached or a `FatalError` is thrown by
the step.

The input (function arguments) and output (return value) of step functions are serialized
into the workflow run's event history. Workflow SDK supports most JavaScript runtime
library types, even beyond normal JSON (so stuff like `Date`, `RegExp`, `Set`, and even
streams are valid inputs/outputs).

## Writing workflows

### Hello world

The most basic workflow example shows how to define execution boundaries
between the workflow function and a step function by using the
`"use workflow"` and `"use step"` directives:

```ts
async function greet(name: string) {
  "use step";
  console.log(`Hello ${name}`);
}

export async function helloWorldWorkflow() {
  "use workflow";
  await greet("world");
}
```

### Control flow

Step functions are JavaScript asynchronous functions. Therefore workflow functions
can orchestrate execution of those functions using standard JavaScript built-in
syntax.

For example, for sequential execution of steps, you `await` one after the other:

```ts
export async function sequentialExecutionWorkflow() {
  "use workflow";

  // run these in order, one after the other
  const a = await greet("1");
  const b = await greet("2");
}
```

For parallel execution, invoke step functions with `Promise.all()`:

```ts
export async function parallelExecutionWorkflow() {
  "use workflow";

  // run these at the same time
  const [a, b] = await Promise.all([
    greet("1"),
    greet("2"),
  ]);
}
```

The rest of the `Promise` execution primitives also work as you
would expect, such as `.race()`, `.any()`, etc.
