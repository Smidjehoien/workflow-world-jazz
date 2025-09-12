import { webhookConsumer } from '@/workflows/webhook-consumer';

export async function POST() {
  const { readable, writable } = new TransformStream<Uint8Array>();
  webhookConsumer(writable);
  return new Response(readable);
}
