# @vercel/workflow-world-embedded

## 0.0.1-alpha.13

### Patch Changes

- 1214755: Improve deeplinking, hook tables, event counting, add events.listByCorrelationId to world
- Updated dependencies [1214755]
- Updated dependencies [314f0fe]
  - @vercel/workflow-world@0.0.1-alpha.9

## 0.0.1-alpha.12

### Patch Changes

- ad9bdbd: Align versions across packages
- Updated dependencies [ad9bdbd]
  - @vercel/workflow-world@0.0.1-alpha.8

## 0.0.1-alpha.11

### Patch Changes

- Updated dependencies [b15a64f]
  - @vercel/workflow-world@0.0.1-alpha.7

## 0.0.1-alpha.10

### Patch Changes

- 75da34e: Add hook entity to observability CLI/Web, add hook listing to world interface
- Updated dependencies [75da34e]
- Updated dependencies [d34c4ac]
- Updated dependencies [1ef8597]
  - @vercel/workflow-world@0.0.1-alpha.6

## 0.0.1-alpha.9

### Patch Changes

- 7b18141: World config now takes named parameters, and header configuration for vercel was moved into world-vercel

## 0.0.1-alpha.8

### Patch Changes

- 59ab1dc: Implement new `Webhook` spec
- Updated dependencies [59ab1dc]
  - @vercel/workflow-world@0.0.1-alpha.5

## 0.0.1-alpha.7

### Patch Changes

- dd1c069: Ensure default sort behavior for list calls is descending by time, and allow optionally sorting by ascending
- 7f756a2: support queue message idempotency, fix storage file overwrites

  - embedded queue now supports `opts.idempotencyKey` on the `Queue.queue` interface.
    this means that we don't run the same steps while it's already running.

  - throw a conflict error `new WorkflowAPIError(msg, { status: 409 })` whenever we try to write
    to a storage file that already exists, unless we explicitly want to `.update` it. This is
    required to avoid creating a limbo state in our storage and makes steps work better with idempotency.

- Updated dependencies [dd1c069]
  - @vercel/workflow-world@0.0.1-alpha.4

## 0.0.1-alpha.6

### Patch Changes

- 689621a: Add initial `Hook` implementation
- f9491a7: Fix race condition in streams implementation
- 9281a86: Consolidate some external deps across packages
- Updated dependencies [689621a]
  - @vercel/workflow-world@0.0.1-alpha.3

## 0.0.1-alpha.5

### Patch Changes

- 07ebb97: Fix concurrent event writes in embedded world
- 01d3679: Use v1 API endpoint for vercel, add web package, extract shared logic from CLI&web into core package

## 0.0.1-alpha.4

### Patch Changes

- 6c93397: Fix for embedded world pagination

## 0.0.1-alpha.3

### Patch Changes

- e275561: Refactor world selection logic in core, and unify with CLI use. Polish pagination. Refactor logging.

## 0.0.1-alpha.2

### Patch Changes

- cd4a41c: extract "world" interface packages
- Updated dependencies [cd4a41c]
  - @vercel/workflow-world@0.0.1-alpha.2
