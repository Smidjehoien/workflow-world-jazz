import { add, sleep } from './steps';

export async function example(i: number) {
  'use workflow';

  const a = await add(i, 7);
  const b = await add(a, 8);
  const c = await Promise.race([sleep(5000, 'Hello, world!'), add(b, 9)]);
  return c;
}
