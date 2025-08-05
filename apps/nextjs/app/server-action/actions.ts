'use server';
import { example } from '../../workflows/workflows';

export async function callWorkflow() {
  const { writable } = new TransformStream();
  return example(writable);
}
