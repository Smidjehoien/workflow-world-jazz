/**
 * Durable version of the add function
 */
export async function pumpData(writable: WritableStream) {
  'use step';
  console.log('pumpData', writable);

  const writer = writable.getWriter();
  await writer.write('first');

  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await writer.write('second');

  return true;
}
