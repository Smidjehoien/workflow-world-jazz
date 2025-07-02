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
rm -rf .vercel/output/functions/api/trigger.func
cp -ra .prebuilt/trigger.func .vercel/output/functions/api/trigger.func
