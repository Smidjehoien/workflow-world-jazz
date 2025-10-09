# Workflow Observability Web UI

A Next.js-based web interface for inspecting workflow runs, steps, streams, and events. This package is designed to be launched from the `@vercel/workflow-cli` package with the `--web` flag, e.g. `wf i runs --web`. It can also be self-hosted to provide a standalone observability UI.

## Installation

### For End Users

When published to npm, install globally:

```bash
npm install -g @vercel/workflow-cli
# or
pnpm install -g @vercel/workflow-cli
```

## Usage

### Via CLI

The primary way to start using the web UI is through the CLI:

```bash
# Basic usage - view local runs in web UI
wf inspect runs --web

# Viewing remote production data
wf inspect events --web \
  --backend=vercel \
  --env=production \
  --project=my-project \
  --team=my-team
```

Once the web UI is started, you can use it to navigate and inspect all available workflow-related data.

## Contributing

### Development Workflow

In the `packages/web` directory, run the server live:

```bash
pnpm dev
```

Then use the web config to point to your local or remote workflow data.
