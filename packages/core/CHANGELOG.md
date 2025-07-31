# @vercel/workflow-core

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
