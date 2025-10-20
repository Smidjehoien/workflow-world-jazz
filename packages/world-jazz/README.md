# workflow-world-jazz

A Jazz-based World implementation for the [Workflow Development Kit](https://useworkflow.dev).

## Installation

```bash
npm install workflow-world-jazz
# or
pnpm add workflow-world-jazz
# or
yarn add workflow-world-jazz
```

## Setup

1. Add your Jazz API key to an `.env.local` file and set the `WORKFLOW_TARGET_WORLD` environment variable to `workflow-world-jazz`:

    ```bash
    export JAZZ_API_KEY=<your-api-key>
    echo "JAZZ_API_KEY=$JAZZ_API_KEY" >> .env.local
    export WORKFLOW_TARGET_WORLD=workflow-world-jazz
    ```

1. Create a Jazz worker account:

    ```bash
    pnpx jazz-run account create --name "Workflow Worker" >> .env.local
    ```

    Your .env.local file should now contain `JAZZ_WORKER_ACCOUNT` and `JAZZ_WORKER_SECRET`.

1. Create a webhook registry and allow the worker created previously to register a webhook:

    ```bash
    pnpx env-cmd -f .env.local -x -- pnpx jazz-run webhook create-registry --grant \$JAZZ_WORKER_ACCOUNT >> .env.local
    ```

    Your .env.local file should now contain `JAZZ_WEBHOOK_REGISTRY_SECRET` and `JAZZ_WEBHOOK_REGISTRY_ID`.

1. Run the webhook registry:

    ```bash
    pnpx env-cmd -f .env.local -- pnpx jazz-run webhook run
    ```

1. In a separate shell, run your app:

    ```bash
    pnpm dev
    ```

## Environment Variables

| Variable                       | Description                                           | Default                                                                    |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `WORKFLOW_TARGET_WORLD`        | Set to `"workflow-world-jazz"` to use this world      | -                                                                          |
| `JAZZ_API_KEY`                 | Jazz API key                                          | -                                                                          |
| `JAZZ_WORKER_ACCOUNT`          | Jazz account that will own all of the workflow data   | -                                                                          |
| `JAZZ_WORKER_SECRET`           | Secret for the worker account                         | -                                                                          |
| `JAZZ_WEBHOOK_REGISTRY_ID`     | CoValue ID for the webhook registry                   | -                                                                          |
| `JAZZ_WEBHOOK_REGISTRY_SECRET` | Secret for the webhook registry                       | -                                                                          |
| `JAZZ_SYNC_SERVER`             | Sync server URL                                       | Jazz Cloud (`wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`)                 |
| `JAZZ_WEBHOOK_ENDPOINT`        | The endpoint where webhooks should get delivered      | `http://localhost:${PORT}` or `http://localhost:3000` if `PORT` is not set |
