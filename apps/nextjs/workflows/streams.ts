import { xxh32 } from '@node-rs/xxhash';

/**
 * Durable version of the add function
 */
export async function pumpData(writable: WritableStream) {
  'use step';
  console.log('pumpData', writable);

  const hash = xxh32('hello', 1);
  console.log('native hash', hash);

  const writer = writable.getWriter();
  await writer.write('first');

  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await writer.write('second');

  return true;
}
