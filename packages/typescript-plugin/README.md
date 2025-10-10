# @vercel/workflow-typescript-plugin

TypeScript Language Service Plugin for Vercel Workflow SDK.

## Features

This plugin enhances the TypeScript editing experience when writing workflows by providing:

### Diagnostics

- **Workflow/Step validation**: Errors when workflow or step functions are not async
- **Disallowed API detection**: Errors when Node.js APIs (like `fs`, `http`, etc.) are used in workflow functions

### Auto-completions

- **Workflow APIs**: Suggests workflow-specific APIs like `createHook()`, `getWorkflowMetadata()`, `getStepMetadata()`, etc. when inside workflow functions

## Installation

```bash
pnpm add -D @vercel/workflow-typescript-plugin
```

Add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@vercel/workflow-typescript-plugin"
      }
    ]
  }
}
```

### Plugin Options

You can configure the plugin with the following options:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@vercel/workflow-typescript-plugin",
        "enableDiagnostics": true,
        "enableCompletions": true
      }
    ]
  }
}
```

- `enableDiagnostics` (default: `true`): Enable custom diagnostics
- `enableCompletions` (default: `true`): Enable custom completions

## Usage

Once configured, the plugin will automatically provide diagnostics and completions when you're editing workflow files.

### Example

```typescript

import { readFileSync } from "node:fs"
export async function myWorkflow() {
  'use workflow';

  // The plugin will suggest workflow APIs here
  const workflowContext = getWorkflowContext();

  // This will trigger a warning about disallowed APIs
  readFileSync('something.txt');  // ⚠️ Warning: fs is not allowed in workflow files
}

// This will trigger a warning about a step not being async
function myStep() {
  'use step';

  // Full Node.js APIs are available here
  import fs from 'fs';  // ✅ OK
}
```

## How it Works

The plugin uses the TypeScript Language Service API to:

1. Detect `"use workflow"` and `"use step"` directives in functions
2. Analyze the code within those functions
3. Provide custom diagnostics and completions based on the context

## Development

```bash
# Build the plugin
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Testing

### Running the Test Suite

The plugin includes a comprehensive test suite using Vitest:

```bash
# Run all tests
pnpm test
```

### Manual Testing

To test the plugin manually in your IDE:

1. Build the plugin: `pnpm build`
2. Add it to your test project's `tsconfig.json`
3. Restart your TypeScript server (in VS Code/Cursor: cmd+shift+P → "TypeScript: Restart TS Server")

## License

MIT
