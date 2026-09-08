/**
 * @module ai/services/embedding.service
 * @description Google Gemini embedding service (text-embedding-004, 768 dims, free tier).
 * Replaces the previous OpenAI embedding calls. The public API surface is identical so
 * no callers (RAG, VectorStore, EmbeddingCache) need changes.
 */

import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import type { EmbeddingResult, BatchEmbeddingResult } from '../types/ai.types.js';
import { aiEnv } from '../config/ai-env.js';
import { withRetry } from '../utils/retry.js';
import { AIError } from '../utils/ai-error.js';
import { logger } from '../../lib/logger.js';

/** Gemini embedding model — 768-dimensional output, free tier. */
const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';

/** Gemini API max inputs per embedContent call (single text at a time; we batch manually). */
const BATCH_SIZE = 50;

let _genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = aiEnv.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

export class EmbeddingService {
  private readonly model: string;

  constructor(model?: string) {
    // Allow override but default to Gemini's embedding model
    this.model = model ?? GEMINI_EMBEDDING_MODEL;
  }

  /** Embed a single text string. */
  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.embedBatch([text]);
    return {
      vector: result.vectors[0]!,
      model: result.model,
      usage: result.usage,
    };
  }

  /**
   * Embed multiple texts in parallel batches.
   * Results preserve input order.
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return { vectors: [], model: this.model, usage: { promptTokens: 0, totalTokens: 0 } };
    }

    const client = getGeminiClient();
    const embeddingModel = client.getGenerativeModel({ model: this.model });
    const allVectors: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);

      const batchVectors = await withRetry(async () => {
        try {
          // Gemini embedContent processes one text at a time — run batch in parallel
          const results = await Promise.all(
            batch.map((text) =>
              embeddingModel.embedContent({
                content: { role: 'user', parts: [{ text }] },
                taskType: TaskType.RETRIEVAL_DOCUMENT,
              })
            )
          );
          return results.map((r) => r.embedding.values);
        } catch (error) {
          this._mapError(error);
          throw error;
        }
      });

      allVectors.push(...batchVectors);

      logger.debug(
        { batchStart: i, batchSize: batch.length },
        '[EmbeddingService] Gemini batch embedded'
      );
    }

    return {
      vectors: allVectors,
      model: this.model,
      // Gemini doesn't return token counts for embeddings — use 0 as placeholder
      usage: { promptTokens: 0, totalTokens: 0 },
    };
  }

  private _mapError(error: unknown): never {
    const msg = error instanceof Error ? error.message : String(error);
    throw new AIError(msg, 'EMBEDDING_FAILED', { provider: 'gemini', retryable: true });
  }
}

export const embeddingService = new EmbeddingService();
