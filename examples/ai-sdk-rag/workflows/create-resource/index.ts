import {
  insertResourceSchema,
  type NewResourceParams,
} from '@/lib/db/schema/resources';
import { generateEmbeddings } from '../shared/embedding';
import { insertEmbeddings, insertResource } from './db';

export async function createResourceWorkflow(input: NewResourceParams) {
  'use step';
  const { content } = await parseResourceInput(input);
  const resource = await insertResource(content);
  const embeddings = await generateEmbeddings(content);
  await insertEmbeddings(resource.id, embeddings);
}

async function parseResourceInput(input: NewResourceParams) {
  'use step';
  return insertResourceSchema.parse(input);
}
