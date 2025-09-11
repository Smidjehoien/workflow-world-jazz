# @vercel/workflow-core

## 0.0.1-alpha.18

### Patch Changes

- 5d04853: Change default max retries from 32 to 3 for workflow steps

## 0.0.1-alpha.17

### Patch Changes

- c7f0d52: Use `world.getDeploymentId()` more consistently to fix local dev

## 0.0.1-alpha.16

### Patch Changes

- 0b2ac90: Set the `deploymentId` option in vqs `send()`
- 7e1e4cf: Export WebhookOptions type

## 0.0.1-alpha.15

### Patch Changes

- a88eeba: automatic oidc token refresh (using newer @vercel/oidc package)
- d19b423: Update core to use new workflow server implementation

## 0.0.1-alpha.14

### Patch Changes

- 94ee3b3: embedded server: use process.env.PORT if exists

## 0.0.1-alpha.13

### Patch Changes

- 1b3dd56: allow to configure the server port. otherwise, a port exposed from the current pid will be used.

  The configuration is done by using a stringified JSON in env vars.

  In case the port is not assigned, we will try to grab the port from the pids,
  and will choose the lowest exposed port, assuming random ports are in the 5-digit range--while the main server ports are usually in the 4-digit range like 3000.

- 54d1ec1: Use `run()` instead of `enterWith()` for AsyncLocalStorage
- de9b26d: Make `pid-port` be a regular dependency

## 0.0.1-alpha.12

### Patch Changes

- 265c34e: Use `@vercel/oidc` package for retrieving the OIDC token information (instead of `@vercel/functions`)

## 0.0.1-alpha.11

### Patch Changes

- aff52c1: Add initial readme instructions
- 06b74d2: Run e2e tests in parallel

## 0.0.1-alpha.10

### Patch Changes

- b8b39e7: Add `stepStartedAt` to `getContext()`
- 326d01f: Re-introduce `sleep()` function
- 2f5b253: Remove 2 second sleep in `start()` function
- 5a0e901: Add OpenTelemetry trace propagation to webhook processing
- 1fed112: Add `@__PURE__` annotation to `contextStorage`

## 0.0.1-alpha.9

### Patch Changes

- 3a342bb: Implement "named webhooks"
- 12cb3fb: Rename useContext to getContext
- 954b621: Make `getWorkflowReturnValue()` return more meaningful errors
- bf0c666: Bail gracefully when a step completes after the workflow has already finished
- 64cf6f1: Add getWorkflowReturnValue
- bf51020: Use `function` instead of arrow syntax for exported functions
- 466cb68: Rename `useWebhook()` to `getWebhook()`
- 49bf2a5: Add OpenTelemetry tracing
- Updated dependencies [b34c907]
  - @vercel/workflow-vm@0.0.1-alpha.3

## 0.0.1-alpha.8

### Patch Changes

- ab7185e: Implement `useWebhook()`

## 0.0.1-alpha.7

### Patch Changes

- 4c4d406: Return from workflow run unless status is "running"
- 0b462ea: add embedded queue system that can be used with an env var

## 0.0.1-alpha.6

### Patch Changes

- 60f4152: Serialize `Error` instances

## 0.0.1-alpha.5

### Patch Changes

- af3ca11: Add `RetryableError`

## 0.0.1-alpha.4

### Patch Changes

- 0d96052: Finish serialization/deserialization logic
- 950d262: Implement `useContext()`
- Updated dependencies [0d96052]
  - @vercel/workflow-vm@0.0.1-alpha.2

## 0.0.1-alpha.3

### Patch Changes

- b8159cf: Change workflow queue names

## 0.0.1-alpha.2

### Patch Changes

- Rebuild packages
- Updated dependencies
  - @vercel/workflow-vm@0.0.1-alpha.1

## 0.0.1-alpha.1

### Patch Changes

- b45e33b: Log `step_failure` events for retryable errors
- e49500b: Prevent multiple steps being created with same `invocation_id`

## 0.0.1-alpha.0

### Patch Changes

- Initial Release
- Updated dependencies
  - @vercel/workflow-vm@0.0.1-alpha.0
