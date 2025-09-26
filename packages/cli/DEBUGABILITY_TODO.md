# CLI and D11y deliverables

## PR 1 - Basic CLI for embedded worlds

Make functions from workflow/core "world" API available to the CLI package for simple text-based interactions.

- [x] Basic CLI commands (list runs, steps, streams, events)
- [x] Scan for a .next folder, and if so, use `.next/workflow-data` as the data dir, otherwise use `.workflow-data`, to make the CLI work with the embedded world
- [x] Don't require PORT definition in the embedded world config, since we're read-only

## PR 2 - Allow access to vercel worlds

- [x] Add explicit `--target [vercel/embedded]` (defaults to `embedded`) to set the world
- [x] Support `--env production` flag (defaults to `production`) 
  - [ ] Support non-production environments (where to grab the token from?)
- [x] When using vercel world, scan and grab API token created by `vercel/vercel` CLI
  - Copied logic from `@vercel/sandbox-sdk`
- [ ] On `workflow-server:lib/auth` accept Vercel-CLI style token
  - Verify that separately to extract owner IDs
  - Accept HTTP headers for specifying project and team
- [x] Ensure the vercel world CLI works against a deployed version of the nextjs-turbopack example app
- [ ] Allow passing team/project scopes for vercel backend, send as headers
  - Later on, vercel queues should support the same auth, so CLI can directly interface with queues
    - Actually, do we? TBD
- [ ] Infer team/project scopes by scanning the `.vercel` folder if available

## PR 3 - Improve CLI

- [ ] Add `wrun_` prefix to run IDs in embedded world, same as `step_` prefix exists for steps
- [ ] Add flag to live-tail stream outputs
- [ ] Add flag to show live table of steps/workflows
- [ ] Add command to pause/resume/cancel/complete runs
  - [ ] Requires improving PORT inference for embedded world
- [ ] Allowing listing steps/events/streams without needing a runId
- [ ] Improve inspect outputs
- [ ] Polish loop until this works well for Vade

## PR 4 - Terminal UI

- [ ] Basic Ink-based terminal UI
- [ ] Think about how to handle a web UI example

## PR 5 - Test Setup

- TBD

## PR 6 - Setup polish

- [ ] Use chalk / log levels correctly
- [ ] For embedded world, ensure it finds the right directory (currently `dataDir` is set to "workflow-data", but should be relative to the build output dir, e.g. `.next/workflow-data`)
- [ ] Add workflow build manifest and infer PORT, dataDir, etc. from that
- [ ] Possibly add workflow.config.ts to set these explicitly
- [ ] `workflow init` command to initialize config files

## PR ? - Embedded world standalone example without Vercel backend

- [ ] Allow embedded world to create its own NodeJS server (see vercel CLI `forkDevServer`)
- [ ] Expand example app to allow the well-known endpoints to be called through workflow CLI by using the internal dev server
