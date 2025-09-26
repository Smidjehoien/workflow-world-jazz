# CLI and D11y deliverables

## PR 1 - Basic CLI for embedded worlds

Make functions from workflow/core "world" API available to the CLI package for simple text-based interactions.

- [x] Basic CLI commands (list runs, steps, streams, events)
- [x] Scan for a .next folder, and if so, use `.next/workflow-data` as the data dir, otherwise use `.workflow-data`, to make the CLI work with the embedded world
- [x] Don't require PORT definition in the embedded world config, since we're read-only

## PR 2 - Support access to vercel world

- [x] Add explicit `--target [vercel/embedded]` (defaults to `embedded`) to set the world
- [x] Support `--env production` flag (defaults to `production`) 
  - [ ] Support non-production environments (where to grab the token from?)
- [x] When using vercel world, scan and grab API token created by `vercel/vercel` CLI
  - Copied logic from `@vercel/sandbox-sdk`
- [x] Ensure the vercel world CLI works against a deployed version of the nextjs-turbopack example app
- [x] Allow passing team/project scopes for vercel backend, send as headers
  - Later on, vercel queues should support the same auth, so CLI can directly interface with queues
    - Actually, do we? TBD
- [ ] On `workflow-server:lib/auth` accept Vercel-CLI style token
  - Verify that separately to extract owner IDs
  - Accept HTTP headers for specifying project and team
- [x] Infer team/project scopes by scanning the `.vercel` folder if available

## PR 3 - Improve CLI

- [ ] Add `wrun_` prefix to run IDs in embedded world, same as `step_` prefix exists for steps
- [x] Add JSON output mode
- [ ] Add flag to live-tail stream and event outputs
- [ ] Add command to pause/resume/cancel/complete runs
  - [ ] Requires improving PORT inference for embedded world
- [ ] Allowing listing steps/events/streams without needing a runId
- [ ] Improve inspect outputs
- [ ] Polish loop until this works well for Vade

## PR 4 - E2E tests

- [x] Add e2e tests to core that CWD into the app and run `wf inspect`, match snapshot
- [x] Add check for deployment URL to see if localhost, if so, set `--backend=vercel` and set deployment URL correctly

## PR 5 - Terminal UI

- [ ] Basic Ink-based terminal UI
- [ ] Think about how to handle a web UI example

## PR 6 - Setup polish

- [ ] Use chalk / log levels correctly
- [x] For embedded world, ensure it finds the right directory (currently `dataDir` is set to "workflow-data", but should be relative to the build output dir, e.g. `.next/workflow-data`)
- [ ] Add workflow build manifest and infer PORT, dataDir, etc. from that
- [ ] Possibly add workflow.config.ts to set these explicitly
  - Basebuilder code has a config type WorkflowConfig, which should become the workflow.config.ts, with zod schema validation, possibly copying next.js code for config parsing/setup
next has embedded stuff, which should be part of this type
- [ ] `workflow init` command to initialize config files

## PR ? - Embedded world standalone example without Vercel backend

- [ ] Allow embedded world to create its own NodeJS server (see vercel CLI `forkDevServer`)
- [ ] Expand example app to allow the well-known endpoints to be called through workflow CLI by using the internal dev server


