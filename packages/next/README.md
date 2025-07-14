# Workflows Next.js Plugin

This is the Next.js config plugin to add workflows handling.

## Setup

Install the package

```sh
pnpm i @vercel/workflow-next
```

Add the plugin in `next.config`

```ts
import { withWorkflow } from '@vercel/workflow-next'

const nextConfig = {}

export default withWorkflow(nextConfig)
```
