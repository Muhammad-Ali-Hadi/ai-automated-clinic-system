/**
 * @module ai/embeddings/embedding-cache
 * @description LRU-style Redis cache for embeddings.
 * Identical texts always produce identical vectors — caching avoids redundant API calls.
 */

import { createHash } from 'node:crypto';
import { getRedisClient } from '../memory/redis-client.js';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';

const CACHE_PREFIX = 'ai:emb:';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class EmbeddingCache {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = aiEnv.AI_CACHE_ENABLED;
  }

  private _key(text: string, model: string): string {
    const hash = createHash('sha256').update(`${model}::${text}`).digest('hex');
    return `${CACHE_PREFIX}${hash}`;
  }

  async get(text: string, model: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this._key(text, model));
      if (!raw) return null;
      return JSON.parse(raw) as number[];
    } catch {
      return null; // Cache miss on error — never block the main path
    }
  }

  async set(text: string, model: string, vector: number[]): Promise<void> {
    if (!this.enabled) return;

    try {
      const redis = await getRedisClient();
      await redis.setEx(this._key(text, model), TTL_SECONDS, JSON.stringify(vector));
    } catch (error) {
      logger.warn({ error }, '[EmbeddingCache] Failed to cache vector — continuing');
    }
  }

  async getOrCompute(
    text: string,
    model: string,
    computeFn: () => Promise<number[]>
  ): Promise<number[]> {
    const cached = await this.get(text, model);
    if (cached) {
      logger.debug('[EmbeddingCache] Cache hit');
      return cached;
    }

    const vector = await computeFn();
    await this.set(text, model, vector);
    return vector;
  }
}

export const embeddingCache = new EmbeddingCache();
