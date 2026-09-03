/**
 * @module ai/services/embedding.service
 * @description OpenAI embedding service with batching and caching support.
 */

import type { EmbeddingResult, BatchEmbeddingResult } from '../types/ai.types.js';
import { getOpenAIClient } from './openai-client.js';
import { aiEnv } from '../config/ai-env.js';
import { withRetry } from '../utils/retry.js';
import { AIError } from '../utils/ai-error.js';
import { logger } from '../../lib/logger.js';

/** OpenAI max inputs per embedding API call. */
const BATCH_SIZE = 96;

export class EmbeddingService {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? aiEnv.OPENAI_EMBEDDING_MODEL;
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
   * Embed multiple texts in batches of up to `BATCH_SIZE`.
   * Results preserve input order.
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return { vectors: [], model: this.model, usage: { promptTokens: 0, totalTokens: 0 } };
    }

    const client = getOpenAIClient();
    const allVectors: number[][] = [];
    let totalPromptTokens = 0;
    let totalTokens = 0;
    let actualModel = this.model;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);

      const response = await withRetry(async () => {
        try {
          return await client.embeddings.create({ model: this.model, input: batch });
        } catch (error) {
          this._mapError(error);
          throw error;
        }
      });

      // Preserve order — OpenAI returns objects with an `index` field
      const sorted = [...response.data].sort((a, b) => a.index - b.index);
      allVectors.push(...sorted.map((d) => d.embedding));
      totalPromptTokens += response.usage.prompt_tokens;
      totalTokens += response.usage.total_tokens;
      actualModel = response.model;

      logger.debug(
        { batchStart: i, batchSize: batch.length, totalTokens: response.usage.total_tokens },
        '[EmbeddingService] Batch embedded'
      );
    }

    return {
      vectors: allVectors,
      model: actualModel,
      usage: { promptTokens: totalPromptTokens, totalTokens },
    };
  }

  private _mapError(error: unknown): never {
    const msg = error instanceof Error ? error.message : String(error);
    throw new AIError(msg, 'EMBEDDING_FAILED', { provider: 'openai', retryable: true });
  }
}

export const embeddingService = new EmbeddingService();
