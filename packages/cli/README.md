# Workflow CLI

A CLI tool for building workflow bundles for Vercel.

## Installation

This package isn't published yet. Just make sure build this package `pnpm run build` or let turbo do it from the repo root and install it as a dev dependency in any package that uses it.

## Usage

The CLI is available as both `workflow` (Or `wf` for shorthand):

```bash
workflow [options]
# OR, for short
wf [options]
```

## Options

### `--target <target>`

Specify the build target for your workflow bundles. Available targets:

- `vercel-static` (default) - Creates static bundles in an `/api` directory according to the vercel `static-build` format. Will be picked up by `vc dev` locally.
- `vercel-build-output-api` - Creates Vercel Build Output API structure with serverless functions

### `--help, -h`

Show help information.

## Examples

### Default Build Target (Vercel Static)

```bash
# Uses vercel-static target by default
wf

# Explicitly specify vercel-static target
wf --target vercel-static

# Using pnpm build (in example app)
pnpm build
```

This creates:
- `./api/generated/steps.js` - Steps bundle
- `./api/generated/workflows.js` - Workflows bundle

### Vercel Build Output API

```bash
wf --target vercel-build-output-api
```

This creates a `.vercel/output` directory structure compatible with the [Vercel Build Output API](https://vercel.com/docs/build-output-api):

```
.vercel/output/
├── config.json
└── functions/
    └── api/
        └── generated/
            ├── steps.func/
            │   ├── .vc-config.json
            │   └── index.js
            └── workflows.func/
                ├── .vc-config.json
                └── index.js
```

The functions will be available at:
- `/api/generated/steps` - Step execution endpoint
- `/api/generated/workflows` - Workflow execution endpoint

## Configuration

Currently configuration is hardcoded but will be made configurable in future versions:

```typescript
const resolvedConfig = {
  dirs: ['./workflows'],
  workingDir: process.cwd(),
  buildTarget: 'vercel-static', // or 'vercel-build-output-api'
  
  // vercel-static paths
  stepsBundlePath: './api/generated/steps.js',
  workflowBundle: './api/generated/workflows.js',
  
  // vercel-build-output-api paths
  buildOutputDir: './.vercel/output',
};
```
