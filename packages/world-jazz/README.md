# @vercel/workflow-world-jazz

Jazz-based workflow backend.

This package is meant to be for internal testing.
For production use, use the official [Jazz World](https://github.com/garden-co/v-workflow/tree/jazz-world) implementation.

## Setup

**Execute these commands in the directory of an app using the Jazz world**

1. Add this package to your project's dependencies:

    ```diff
    @@ -1,6 +1,7 @@
     {
       "dependencies": {
    +     "@vercel/workflow-world-jazz": "workspace:*"
       }
     }
    ```

2. Add your Jazz API key to the .env.local file and set the WORKFLOW_TARGET_WORLD environment variable to @vercel/workflow-world-jazz:

    ```bash
    export JAZZ_API_KEY=<your-api-key>
    echo "JAZZ_API_KEY=$JAZZ_API_KEY" >> .env.local
    export WORKFLOW_TARGET_WORLD=@vercel/workflow-world-jazz
    ```

2. Create a jazz worker account:

    ```bash
    pnpx https://pkg.pr.new/garden-co/jazz/jazz-run@4c061d8c81fb6fd1413d4be970c76c3d1d1495c6 account create --name "Workflow Worker" >> .env.local
    ```

    Your .env.local file should now contain `JAZZ_WORKER_ACCOUNT` and `JAZZ_WORKER_SECRET`.

3. Create a webhook registry and allow the worker created in step 2 to register a webhook:

    ```bash
    pnpx env-cmd -f .env.local -x -- pnpx https://pkg.pr.new/garden-co/jazz/jazz-run@4c061d8c81fb6fd1413d4be970c76c3d1d1495c6 webhook create-registry --grant \$JAZZ_WORKER_ACCOUNT >> .env.local
    ```

    Your .env.local file should now contain `JAZZ_WEBHOOK_REGISTRY_SECRET` and `JAZZ_WEBHOOK_REGISTRY_ID`.
    ```

4. Run the webhook registry:

    ```bash
    pnpx env-cmd -f .env.local -- pnpx https://pkg.pr.new/garden-co/jazz/jazz-run@4c061d8c81fb6fd1413d4be970c76c3d1d1495c6 webhook run
    ```

5. Run your app:

    ```bash
    pnpm dev
    ```
