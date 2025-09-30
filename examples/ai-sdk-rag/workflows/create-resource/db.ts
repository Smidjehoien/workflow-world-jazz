import { db } from '@/lib/db';
import { resources } from '@/lib/db/schema/resources';
import { embeddings as embeddingsTable } from '@/lib/db/schema/embeddings';

export async function insertResource(content: string) {
  'use step';
  const [resource] = await db.insert(resources).values({ content }).returning();
  return resource;
}

export async function insertEmbeddings(
  resourceId: string,
  embeddings: { embedding: number[]; content: string }[]
) {
  'use step';
  await db.insert(embeddingsTable).values(
    embeddings.map((embedding: { embedding: number[]; content: string }) => ({
      resourceId,
      ...embedding,
    }))
  );
}
