# @vercel/workflow-typescript-plugin

TypeScript Language Service Plugin for Vercel Workflow SDK.

## Features

This plugin enhances the TypeScript editing experience when writing workflows by providing:

### Diagnostics

- **Workflow/Step validation**: Warns when workflow or step functions are not async
- **Disallowed API detection**: Warns when Node.js APIs (like `fs`, `http`, etc.) are used in workflow functions

### Auto-completions

- **Workflow hooks**: Suggests workflow-specific hooks like `getWebhook()`, `getWorkflowContext()`, `getStepContext()`, etc. when inside workflow functions

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

  // The plugin will suggest workflow hooks here
  const webhook = getWebhook({ ... });

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

# Type check
pnpm typecheck
```

## Testing

To test the plugin locally:

1. Build the plugin: `pnpm build`
2. Add it to your test project's `tsconfig.json`
3. Restart your TypeScript server (in VS Code: cmd+shift+P → "TypeScript: Restart TS Server")

## License

MIT
