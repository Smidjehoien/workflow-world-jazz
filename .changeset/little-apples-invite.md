---
"@vercel/workflow-world-embedded": patch
---

support queue message idempotency, fix storage file overwrites

- embedded queue now supports `opts.idempotencyKey` on the `Queue.queue` interface.
  this means that we don't run the same steps while it's already running.

- throw a conflict error `new WorkflowAPIError(msg, { status: 409 })` whenever we try to write
  to a storage file that already exists, unless we explicitly want to `.update` it. This is
  required to avoid creating a limbo state in our storage and makes steps work better with idempotency.
