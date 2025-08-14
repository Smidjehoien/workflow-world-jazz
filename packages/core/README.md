## @vercel/workflow-core

> [!TIP]
>
> **Workflow SDK** is a framework for writing and executing _durable functions_.
>
> To learn about what are durable functions, why should you care, and how
> to write them, please see [Concepts](./docs/concepts.md).

This package contains the functions and primitives that are
used within workflows.

### Installation

```bash
pnpm add @vercel/workflow-core
# or
npm i @vercel/workflow-core
# or
yarn add @vercel/workflow-core
```

### API reference

  - **getContext()**: workflow- or step-safe context accessor
  - **getWebhook(options?)**: create an awaitable webhook endpoint
  - **sleep(ms)**: deterministic sleep helper for workflows
  - **FatalError / RetryableError**: error helpers for step control flow

### Next.js integration

See the [`@vercel/workflow-next` documentation](../next/README.md) for instructions
on enabling workflows for your Next.js application.
