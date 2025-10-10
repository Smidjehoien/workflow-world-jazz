import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { getWorld } from '@vercel/workflow';
import { start } from '@vercel/workflow/api';
import { Hono } from 'hono';
import * as z from 'zod';
import * as flow from '../.well-known/workflow/v1/flow.js';
import manifest from '../.well-known/workflow/v1/manifest.debug.json' with {
  type: 'json',
};
import * as step from '../.well-known/workflow/v1/step.js';

if (!process.env.WORKFLOW_TARGET_WORLD) {
  console.error(
    'Error: WORKFLOW_TARGET_WORLD environment variable is not set.'
  );
  process.exit(1);
}

type Files = keyof typeof manifest.workflows;
type Workflows<F extends Files> = keyof (typeof manifest.workflows)[F];

const Invoke = z
  .object({
    file: z.literal(Object.keys(manifest.workflows) as Files[]),
    workflow: z.string(),
    args: z.unknown().array().default([]),
  })
  .transform((obj) => {
    const file = obj.file as keyof typeof manifest.workflows;
    const workflow = z
      .literal(
        Object.keys(manifest.workflows[file]) as Workflows<typeof file>[]
      )
      .parse(obj.workflow);
    return {
      args: obj.args,
      workflow: manifest.workflows[file][workflow],
    };
  });

const app = new Hono()
  .post('/.well-known/workflow/v1/flow', (ctx) => {
    return flow.POST(ctx.req.raw);
  })
  .post('/.well-known/workflow/v1/step', (ctx) => {
    return step.POST(ctx.req.raw);
  })
  .get('/_manifest', (ctx) => ctx.json(manifest))
  .post('/invoke', async (ctx) => {
    const json = await ctx.req.json().then(Invoke.parse);
    const handler = await start(json.workflow, json.args);

    return ctx.json({ runId: handler.runId });
  })
  .get('/runs/:runId', async (ctx) => {
    return ctx.json(await getWorld().runs.get(ctx.req.param('runId')));
  });

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 0,
  },
  (info) => {
    console.log(`👂 listening on http://${info.address}:${info.port}`);
    console.log('');

    if (process.env.CONTROL_FD === '3') {
      const control = fs.createWriteStream('', { fd: 3 });
      control.write(`${JSON.stringify({ state: 'listening', info })}\n`);
      control.end();
    }

    process.env.PORT = info.port.toString();

    for (const [filename, workflows] of Object.entries(manifest.workflows)) {
      for (const workflowName of Object.keys(workflows)) {
        console.log(
          `$ curl -X POST http://localhost:${info.port}/invoke -d '${JSON.stringify(
            {
              file: filename,
              workflow: workflowName,
            }
          )}'`
        );
      }
    }
  }
);
