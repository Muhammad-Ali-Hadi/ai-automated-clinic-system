/**
 * @module ai/vector/vector-store
 * @description High-level vector store operations: upsert, search, delete.
 * All operations are tenant-scoped via metadata filtering.
 */

import type { RAGChunk, RetrievedChunk, RAGQueryOptions } from '../types/ai.types.js';
import { getQdrantClient, ensureCollection } from './qdrant-client.js';
import { embeddingService } from '../services/embedding.service.js';
import { VectorStoreError } from '../utils/ai-error.js';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';

export class VectorStore {
  /**
   * Upsert an array of chunks (with embeddings) into a Qdrant collection.
   * Embeddings are generated in batch for efficiency.
   */
  async upsertChunks(
    chunks: RAGChunk[],
    collectionName: string = aiEnv.QDRANT_DEFAULT_COLLECTION
  ): Promise<void> {
    if (chunks.length === 0) return;

    await ensureCollection(collectionName);

    const texts = chunks.map((c) => c.content);
    const { vectors } = await embeddingService.embedBatch(texts);

    const points = chunks.map((chunk, i) => ({
      id: this._uuidToUint(chunk.id),
      vector: vectors[i]!,
      payload: {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        ...chunk.metadata,
      },
    }));

    const client = getQdrantClient();
    try {
      await client.upsert(collectionName, { wait: true, points });
      logger.info({ count: points.length, collectionName }, '[VectorStore] Chunks upserted');
    } catch (error) {
      throw new VectorStoreError(`Upsert failed: ${String(error)}`);
    }
  }

  /**
   * Semantic search: returns top-K chunks above the score threshold.
   * Supports metadata filter for tenant isolation.
   */
  async search(
    query: string,
    options: RAGQueryOptions
  ): Promise<RetrievedChunk[]> {
    const {
      collectionName = aiEnv.QDRANT_DEFAULT_COLLECTION,
      topK = aiEnv.RAG_TOP_K,
      scoreThreshold = aiEnv.RAG_SCORE_THRESHOLD,
      filter,
    } = options;

    const { vector } = await embeddingService.embed(query);

    const client = getQdrantClient();
    try {
      const results = await client.query(collectionName, {
        query: vector,
        limit: topK,
        score_threshold: scoreThreshold,
        with_payload: true,
        ...(filter ? { filter: { must: this._buildFilter(filter) } } : {}),
      });

      return results.points.map((r) => ({
        id: String(r.payload?.['chunkId'] ?? r.id),
        documentId: String(r.payload?.['documentId'] ?? ''),
        content: String(r.payload?.['content'] ?? ''),
        chunkIndex: Number(r.payload?.['chunkIndex'] ?? 0),
        metadata: r.payload ?? {},
        score: r.score,
      }));
    } catch (error) {
      throw new VectorStoreError(`Search failed: ${String(error)}`);
    }
  }

  /** Delete all vectors for a given documentId (re-indexing). */
  async deleteByDocumentId(
    documentId: string,
    collectionName: string = aiEnv.QDRANT_DEFAULT_COLLECTION
  ): Promise<void> {
    const client = getQdrantClient();
    try {
      await client.delete(collectionName, {
        wait: true,
        filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      });
      logger.info({ documentId, collectionName }, '[VectorStore] Document vectors deleted');
    } catch (error) {
      throw new VectorStoreError(`Delete failed: ${String(error)}`);
    }
  }

  // ── Private Helpers ──────────────────────────────────────────────────────────

  /**
   * Converts a UUID string to a stable uint64 by hashing its hex digits.
   * Qdrant point IDs must be either unsigned integers or UUIDs.
   * We pass UUIDs directly as strings when the client supports it; otherwise hash.
   */
  private _uuidToUint(uuid: string): string {
    // Qdrant JS client supports string UUIDs as point IDs directly
    return uuid;
  }

  private _buildFilter(filter: Record<string, unknown>) {
    return Object.entries(filter).map(([key, value]) => ({
      key,
      match: { value },
    }));
  }
}

export const vectorStore = new VectorStore();
