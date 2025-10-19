import { registerOTel } from '@vercel/otel';

registerOTel({ serviceName: 'example-nextjs-workflow' });

if (process.env.NEXT_RUNTIME !== 'edge') {
  // kickstart the world
  import('@vercel/workflow/runtime').then(async ({ getWorld }) => {
    await getWorld().start?.();
  });
}
