# CLI and D11y deliverables

## PR 1 - Basic CLI for embedded worlds

Make functions from workflow/core "world" API available to the CLI package for simple text-based interactions.

- [x] Basic CLI commands (list runs, steps, streams, events)
- [x] Scan for a .next folder, and if so, use `.next/workflow-data` as the data dir, otherwise use `.workflow-data`, to make the CLI work with the embedded world
- [x] Don't require PORT definition in the embedded world config, since we're read-only

## PR 2/3 - Support access to vercel world, infer context

- [x] Add explicit `--target [vercel/embedded]` (defaults to `embedded`) to set the world
- [x] Support `--env production` flag (defaults to `production`) 
  - [ ] Support non-production environments (where to grab the token from?)
- [x] When using vercel world, scan and grab API token created by `vercel/vercel` CLI
  - Copied logic from `@vercel/sandbox-sdk`
- [x] Ensure the vercel world CLI works against a deployed version of the nextjs-turbopack example app
- [x] Allow passing team/project scopes for vercel backend, send as headers
  - Later on, vercel queues should support the same auth, so CLI can directly interface with queues
    - Actually, do we? TBD
- [x] Infer team/project scopes by scanning the `.vercel` folder if available
- ~On `workflow-server:lib/auth` accept Vercel-CLI style token~
  - Verify that separately to extract owner IDs
  - Accept HTTP headers for specifying project and team
- [x] Create a proxy as the vercel backend target that handles token auth and
  internally proxies to workflow-server, to handle the above auth

## PR 4 - E2E tests and polish

- [x] Add basic e2e tests to ensure CLI can be invoked and returns content
- [x] Add tests for vercel backend
- [x] Add CLI argument to allow proxy path (--host)
- [x] Add check for deployment URL to see if localhost, if so, set `--backend=vercel` and set deployment URL correctly
- [x] Add JSON flag support

## PR 5 - CLI command polish

- [x] Add help text for commands
- [x] Ensure list/show calls for all resources are nicely formatted
- [x] Serialize I/O for runs/steps correctly
- [x] Ensure streams are stubbed and separately accessible
- [x] Ensure following a stream live streams to console until stream close
  - Should also work with JSON mode (JSONL / NDJSON)
- [x] Detect environment (vercel hosted vs. vercel non-hosted) and set proxy URL accordingly
- [x] Ensure JSON output has no other polluting output and works well with e.g. `jq`
- [x] Print timestamps relative to user time unless in JSON mode
- [x] Ensure embedded world uses ID prefixes (https://github.com/vercel/workflow/pull/223) 
- [x] Add simple pagination support for inspect command
- [x] Add infobox for pagination/stream/inspect help, after a table gets printed

## PR 6 - Allowing listing steps/events/streams without needing a runId
- [x] First, locally support this by doing a wide search (inefficient, don't use!)
- [x] Make PR for workflow-server to support secondary index queries and update API
  - See [branch](https://github.com/vercel/workflow-server/tree/%40pranaygp/step-get-put-without-run-id-dependency)
- [x] Extend world interface, and embedded/vercel worlds to use new rules
- [x] Update CLI code to use new API where applicable, with some performance safeguards

## PR 7 - Support `start` command and manifest
  
- [x] Improve PORT inference for embedded world
- [x] Remove "read-only" mode
- [ ] Scan workflow build manifest (maybe infer PORT, dataDir, etc. from that if available) and provide workflow definition lookup
- [x] Add start command with basic JSON input parsing (no streams)
  - Ensure there's some docs about this in the info box, easy to get wrong
- [ ] Add a getManifest method or similar to the world interface in order to retrieve valid workflow names
- [x] Add infobox after running start for how to follow run stream / event stream / wait for output

# PR 8 - Web UI MVP

- [x] Add a web package that's a NextJS project depending on `workflow/core`, able to show data by accessing the world interface directly
  - The npm package should only publish the built version of this
- [x] Take all of the args/envs that the CLI takes as query params
- [x] CLI `wf inspect --web` should ensure web package is globally installed
  - Locally it should be linked to the neighbor package
- [x] CLI web call should seed web UI with CLI-given variables so ensure it's accessing the same world in the same way
- [x] Add a readme for local dev
- [x] Web UI should show the same `runs` tables as the CLI, using ShadCN
- [x] Build out Web UI functionality, live streaming, ensuring all content is visible, etc.
- [x] Add timeline view
- [x] Ensure pagination works
- [x] Fix flicker / optimize render performance
- [x] Ensure opening UI works well for vercel backend
- [x] Bundle next app correctly and ensure prod version can be pulled

# PR 9 - Web UI / CLI UX Polish

- [x] Shorten CLI input/output args
- [ ] Use `next export`
- [ ] Vercel backend: ensure we can pass deployment ID to filter
- [x] Add CLI/web instructions to main docs + READMEs
- [ ] Bug: only seeing the last two runs for storytime. Do deployment ID (un)filtering?
- [x] Make cancel command work (currently 415 error)
- [ ] Don't resolve refs for input/output data by default, only resolve in detail views
- [ ] Locally paginate (but pull more than the default page size in the background)
- [ ] Bundle next app and ensure prod version can be pulled
- [ ] Tests
- [ ] Fix differentiation in API calls between empty results and error responses
- [ ] Refactor workflow-server and vercel/embedded backend to ensure all list calls are timestamp descending by default, and have unified options for ascending

# PR 10 - Future

- [ ] Add a world config attribute that hides input/output data output in CLI and web UI, later to be re-used for e2e encryption
- [ ] Catch WorkflowAPIError in CLI/web UI and check status for potential 403 issue / token refresh detection
- [ ] Don't bundle JS source maps for web package
- [ ] Refactor for maintainability, use SWR
  - [ ] Fix differentiation in API calls between empty results and error responses
- [ ] Add web UI integration tests
- [ ] Refactor workflow-server and vercel/embedded backend to ensure all list calls are timestamp descending by default, and have unified options for selecting ascending/descending
- [ ] Add CLI instructions to the docs
- [ ] Add commands to stop the server deamon
- [ ] Cache network calls where possible
- [ ] Use custom node dependency resolve instead of default `resolve`

## TBD - not assigned a priority yet
- [ ] When running the workflow CLI, detect if we're running through a global install, and if so, and we're in a local workspace, use the local install of the web UI package, otherwise use the global install
- [ ] Ensure as much of the web UI app as possible is in SSR
- [ ] Use actual/better Gantt chart for UI timeline view. Also add one to main page for runs.
- [ ] Handle upgrade of web UI by detecting version on CLI use, and stop/re-download if old
- [ ] Ensure all resources are listed in reverse-chronological order by default
- [ ] Add unit tests on workflow-server for checking `remoteRefBehavior: resolve` on /runs return data
- [ ] Move all the logging code to `core` and re-use in `core`
- [ ] Support `pause`/`unpause`/`cancel` commands
  - This is TBD given we don't have implementations or a complete spec for these yet
- [ ] Detect interactive mode to allow cursor capture for pagination. Reduce hints in non-interactive mode.
- [ ] Better error handling/messages for when world calls fail
- [ ] Support `wf i webhooks` to list/show webhooks
- [ ] Allow passing IDs without a resource, and infer resource type by ID
- [ ] Validate IDs passed against prefixes to show helpful warnings when the wrong IDs are being used
- [ ] Use `@vercel/auth-cli` package instead of our copied auth code, once package is released, after checking it serves our purpose.
- [ ] Allow pagination with back/forward commands
- [ ] Unify logging implementation between CLI logger and 
- [ ] Support `workflow.config.ts`
  - (Basebuilder code has a config type WorkflowConfig, which should become the workflow.config.ts, with zod schema validation, possibly copying next.js code for config parsing/setup. Next has embedded stuff, which should be part of this type)
- [ ] `wf init` command to initialize config files
- [ ] Allow embedded world to create its own NodeJS server (see vercel CLI `forkDevServer`) ([code](https://github.com/vercel/vercel/blob/main/packages/node/src/start-dev-server.ts)) for standalone example app
- [ ] Expand workbench/example app to allow the well-known endpoints to be called through workflow CLI by using the internal dev server



