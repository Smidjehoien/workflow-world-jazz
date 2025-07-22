import { add, consumeStreams, genStream, sleep } from './steps';

export async function example(i: number) {
  'use workflow';
  const [a, b] = await Promise.all([add(i, 7), add(i, 8)]);
  const d = await add(a, b);
  return d;
}

export async function stream() {
  'use workflow';
  const [s1, s2] = await Promise.all([genStream(), genStream()]);
  const b = await consumeStreams(s1, s2);
  return b;
}
