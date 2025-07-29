import { xxh32 } from '@node-rs/xxhash';
import { pumpData } from './streams';

export async function example(writable: WritableStream) {
  'use workflow';
  console.log('example workflow', { writable });

  const hash = xxh32('hello', 1);
  console.log(hash);

  await pumpData(writable);
  writable.getWriter().close();
}
