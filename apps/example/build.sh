#!/bin/sh

# A temporary hack to merge the build output from .prebuilt into the
# .vercel/output. This allows us to build workflow to the build output API
# target and add additional routes. Really, the build output API should handle
# merging or supporting pre/post build hooks

set -euo pipefail

# build the workflow
pnpm run build:workflow

# setup a trigger function
mkdir -p .vercel/output/functions/api
cp -r .prebuilt/trigger.func .vercel/output/functions/api/trigger.func

# setup a static file
mkdir -p .vercel/output/static
echo 'Hello, world!' > .vercel/output/static/index.html