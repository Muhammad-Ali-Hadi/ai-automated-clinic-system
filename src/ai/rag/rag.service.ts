/**
 * @module ai/rag/rag.service
 * @description Retrieval-Augmented Generation service.
 * Orchestrates: query → embed → vector search → context assembly → LLM response.
 */

import type { RAGChunk, RAGQueryOptions, RAGResult } from '../types/ai.types.js';
import type { CompletionOptions } from '../types/ai.types.js';
import { vectorStore } from '../vector/vector-store.js';
import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { chunkDocument } from '../utils/chunk.js';
import { embeddingService } from '../services/embedding.service.js';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';
import { randomUUID } from 'node:crypto';

export interface RAGIngestOptions {
  collectionName?: string;
  chunkSize?: number;
  overlap?: number;
  metadata?: Record<string, unknown>;
}

export interface RAGQueryResult {
  answer: string;
  retrievedChunks: RAGResult['chunks'];
  context: string;
  latencyMs: number;
}

export class RAGService {
  /**
   * Ingest a document into the vector store.
   * Chunks → embeds → upserts into Qdrant.
   */
  async ingest(
    content: string,
    documentId: string = randomUUID(),
    options: RAGIngestOptions = {}
  ): Promise<{ documentId: string; chunksIndexed: number }> {
    const {
      collectionName = aiEnv.QDRANT_DEFAULT_COLLECTION,
      chunkSize = aiEnv.RAG_CHUNK_SIZE,
      overlap = aiEnv.RAG_CHUNK_OVERLAP,
      metadata = {},
    } = options;

    const chunks: RAGChunk[] = chunkDocument(documentId, content, metadata, { chunkSize, overlap });

    await vectorStore.upsertChunks(chunks, collectionName);

    logger.info({ documentId, chunksIndexed: chunks.length }, '[RAGService] Document ingested');
    return { documentId, chunksIndexed: chunks.length };
  }

  /**
   * Retrieve relevant context chunks for a query.
   */
  async retrieve(query: string, options: RAGQueryOptions): Promise<RAGResult> {
    const chunks = await vectorStore.search(query, options);
    const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
    return { chunks, context };
  }

  /**
   * Full RAG pipeline: retrieve context → assemble prompt → generate answer.
   */
  async query(
    userQuestion: string,
    queryOptions: RAGQueryOptions,
    completionOptions: CompletionOptions = {}
  ): Promise<RAGQueryResult> {
    const startMs = Date.now();

    const { chunks, context } = await this.retrieve(userQuestion, queryOptions);

    if (chunks.length === 0) {
      logger.warn({ userQuestion }, '[RAGService] No relevant chunks found — answering without context');
    }

    const messages = promptManager.render('rag-medical-qa', {
      RETRIEVED_CONTEXT: context || 'No relevant knowledge found.',
      USER_QUESTION: userQuestion,
    });

    const result = await chatService.complete(messages, completionOptions);

    return {
      answer: result.content,
      retrievedChunks: chunks,
      context,
      latencyMs: Date.now() - startMs,
    };
  }

  /** Remove all vectors for a given document (before re-indexing). */
  async deleteDocument(
    documentId: string,
    collectionName: string = aiEnv.QDRANT_DEFAULT_COLLECTION
  ): Promise<void> {
    await vectorStore.deleteByDocumentId(documentId, collectionName);
  }
}

export const ragService = new RAGService();
