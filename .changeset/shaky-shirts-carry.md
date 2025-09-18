---
"@vercel/workflow-core": patch
"@vercel/workflow-next": patch
---

create an embedded backend for the embedded world

a `World` now consists of the following sub-interfaces:

- Queue (how do we queue jobs?)
- Storage (how do we store data?)
- Streamer (how do we stream data?)
- AuthProvider (grabbing auth info, this is questionable though, might be removed later)

There are two `World` implementations provided in `core`:

- `Vercel` is used when `process.env.VERCEL_DEPLOYMENT_ID` exists. It communicates with the Vercel Workflow Server for storage and streaming, and using Vercel Queue for queuing jobs.
- `Embedded` is used otherwise. It uses ephemeral filesystem for storage and streaming, and a local embedded in-memory queue implementation.
