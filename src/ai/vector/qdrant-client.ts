/**
 * @module ai/vector/qdrant-client
 * @description Qdrant vector database client factory and low-level helpers.
 * All vector store operations pass through this module.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { aiEnv } from '../config/ai-env.js';
import { VectorStoreError } from '../utils/ai-error.js';
import { logger } from '../../lib/logger.js';

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    _client = new QdrantClient({
      url: aiEnv.QDRANT_URL,
      ...(aiEnv.QDRANT_API_KEY ? { apiKey: aiEnv.QDRANT_API_KEY } : {}),
    });
  }
  return _client;
}

/** Standard vector size for text-embedding-3-small (1536) and text-embedding-3-large (3072). */
export const VECTOR_SIZE_SMALL = 1_536;
export const VECTOR_SIZE_LARGE = 3_072;

/**
 * Ensures a named collection exists in Qdrant.
 * Creates it with cosine distance if it does not exist.
 */
export async function ensureCollection(
  collectionName: string,
  vectorSize: number = VECTOR_SIZE_SMALL
): Promise<void> {
  const client = getQdrantClient();

  try {
    const exists = await client.collectionExists(collectionName);
    if (exists.exists) return;

    await client.createCollection(collectionName, {
      vectors: { size: vectorSize, distance: 'Cosine' },
      optimizers_config: { default_segment_number: 2 },
      replication_factor: 1,
    });

    logger.info({ collectionName, vectorSize }, '[Qdrant] Collection created');
  } catch (error) {
    throw new VectorStoreError(`Failed to ensure collection "${collectionName}": ${String(error)}`);
  }
}

/**
 * Deletes a collection. Use with caution — irreversible.
 */
export async function dropCollection(collectionName: string): Promise<void> {
  const client = getQdrantClient();
  try {
    await client.deleteCollection(collectionName);
    logger.warn({ collectionName }, '[Qdrant] Collection dropped');
  } catch (error) {
    throw new VectorStoreError(`Failed to drop collection "${collectionName}": ${String(error)}`);
  }
}
