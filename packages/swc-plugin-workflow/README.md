# SWC Plugin for Workflow Directives

This is an SWC transform plugin that handles the `"use step"` directive for Vercel Workflow.

## Development

[Install rust](https://www.rust-lang.org/tools/install)

Add build target using rustup
```bash
rustup target add wasm32-unknown-unknown
```

Ensure you can test/build

```bash
cargo test
cargo check
cargo build
```

Release builds are done using `pnpm build`

## Overview

The `"use step"` directive works similarly to React's `"use server"` directive. Functions marked with `"use step"` are:
- Extracted to separate API route files
- Wrapped with `handleStep()` and exported as POST handlers
- Replaced in the original code with calls to `useStep()`

## Example

### Input Code
```typescript
async function add(a, b) {
  "use step";
  return a + b;
}

add(1, 2);
```

### Output Code

**Original file:**
```typescript
import { useStep } from '@vercel/workflow-core/dist/step';

useStep('add')(1, 2);
```

**Generated file (api/steps/add.ts):**
```typescript
import { handleStep } from '@vercel/workflow-core';

async function add(a, b) {
  return a + b;
}

export const POST = handleStep(add);
```

## Module-Level Directive

You can add the directive to the top of a file to mark all exports as step functions:

```typescript
"use step";

export async function processOrder(orderId) {
  return { processed: true };
}

export async function sendEmail(to, subject) {
  return { sent: true };
}
```

## Requirements

- Functions must be `async`
- Arguments and return values must be serializable
- The directive must be at the beginning of the function or module
- Use single or double quotes (not backticks)

## Implementation Notes

This is a minimal implementation that:
1. Detects functions with the `"use step"` directive
2. Validates they are async functions
3. Transforms them into step function proxies
4. Generates the necessary imports

In a production implementation, the transform would also:
- Write extracted functions to separate files
- Handle more complex cases (closures, etc.)
- Integrate with the build system 