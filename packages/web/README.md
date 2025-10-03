# Workflow Observability Web UI

A Next.js-based web interface for inspecting Flow runs, steps, streams, and events. This package is designed to be launched from the `@vercel/workflow-cli` package with the `--web` flag, e.g. `wf i runs --web`.

## Overview

The Workflow Web UI provides a browser-based interface for workflow observability. Instead of viewing workflow data in the terminal, users can launch a web interface that displays the same information with a more interactive and visual experience.

This UI can also be used to view production data remotely, and can be self hosted as an observability UI.

### Architecture

```
┌─────────────────┐
│  CLI Command    │
│  wf i runs --web│
└────────┬────────┘
         │
         ├──> Checks if web package exists
         ├──> Installs package if needed (.next missing)
         ├──> Starts/reuses Next.js server (port 3456)
         ├──> Converts CLI flags → query params
         └──> Opens browser
                │
                ▼
         ┌──────────────┐
         │  Web UI      │
         │  localhost:  │
         │  3456        │
         └──────────────┘
```

## Installation

### For End Users

When published to npm, install globally:

```bash
npm install -g @vercel/workflow-web
# or
pnpm install -g @vercel/workflow-web
```

The CLI will automatically detect and use the installed package.

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

Once the web UI is started, you can use it to navigate and inspect all available flow-related data.

All CLI flags are automatically converted to query parameters and passed to the web UI.

### Direct Browser Access

When installed globally, the CLI can start the production server using `npx next start`,
after which you can access the server at `http://localhost:3456` (or any port it is running under).

## Local Development

### Development Workflow

For active development on the web UI, use the Next.js development server for hot reloading:

#### 1. Start the Web Dev Server

In the `packages/web` directory:

```bash
pnpm dev
```

This starts Next.js in development mode on port 3456, where the CLI will find it.

#### 2. Visit the URL, or invoke via CLI

When you run the CLI with `--web`, it will:
- Detect if a server is already running on the configured port
- Reuse the existing server instead of starting a new one

```bash
wf inspect runs --web
```

### Building for Production

To test the production build locally:

```bash
# Build the Next.js app
pnpm build

# Start the production server
pnpm start

# Or let the CLI start it
wf inspect runs --web
```

### How the CLI Finds the Web Package

The CLI detection logic (`packages/cli/src/lib/inspect/web.ts`):

1. **Development Mode** (monorepo):
   - Looks for `packages/web` as a sibling directory
   - Uses relative path: `../../../../web` from CLI module location

2. **Production Mode** (installed globally):
   - Resolves `@vercel/workflow-web` from node_modules
   - Uses the installed package location

## Troubleshooting

### "Web package not installed" error

**In Development:**
- Ensure you're in the monorepo workspace
- Check that `packages/web` directory exists
- Run `pnpm install` in the root

**In Production:**
- Install globally: `npm install -g @vercel/workflow-web`
- Check installation: `npm list -g @vercel/workflow-web`

### Server won't start

- Check if port 3456 is already in use: `lsof -i :3456`
- Kill existing process: `kill -9 <PID>`
- Try starting manually: `cd packages/web && pnpm start`

### Changes not reflected

- Ensure you're running `pnpm dev` (not `pnpm start`)
- Check browser console for errors
- Clear `.next` directory and rebuild: `rm -rf .next && pnpm build`

### CLI doesn't detect dev server

- Ensure dev server is running on port 3456: `pnpm dev -- -p 3456`
- Check server is accessible: `curl http://localhost:3456`
- Check CLI verbose output: `wf inspect runs --web --verbose`
