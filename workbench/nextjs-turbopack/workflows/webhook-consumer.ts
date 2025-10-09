import { getWebhook } from '@vercel/workflow';
import { write } from './streams';

export async function webhookConsumer(writable: WritableStream<Uint8Array>) {
  'use workflow';

  const webhook = getWebhook({
    url: '/api/webhook',
    method: ['GET', 'PUT', 'POST', 'HEAD', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  console.log('listening on webhook', webhook.url);

  await write(writable, `Listening on ${webhook.url}`, true);

  while (true) {
    const req = await webhook;
    console.log('received request', {
      method: req.method,
      url: req.url,
      body: await req.text(),
      headers: Object.fromEntries(req.headers),
    });

    if (req.method === 'DELETE') {
      break;
    }
  }

  console.log('finito!');
}
