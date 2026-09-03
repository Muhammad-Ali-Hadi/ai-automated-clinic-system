/**
 * @module ai/analytics/token-usage-tracker
 * @description Records every AI request's token usage, latency, and outcome.
 * Uses an in-memory buffer that flushes to MongoDB in batches.
 * Falls back to structured logging when MongoDB is unavailable.
 */

import type { AIUsageRecord, TokenUsage, AIProvider } from '../types/ai.types.js';
import { logger } from '../../lib/logger.js';
import { randomUUID } from 'node:crypto';

/**
 * Minimal MongoDB-compatible interface so we can swap drivers without coupling.
 * The actual `MongoClient` is injected at runtime.
 */
export interface UsageRepository {
  insertMany(records: AIUsageRecord[]): Promise<void>;
}

const FLUSH_INTERVAL_MS = 10_000; // 10 s
const BUFFER_MAX = 500;

export class TokenUsageTracker {
  private _buffer: AIUsageRecord[] = [];
  private _repo: UsageRepository | null = null;
  private _flushTimer: ReturnType<typeof setInterval> | null = null;

  /** Optionally inject a real repository for persistence. */
  setRepository(repo: UsageRepository): void {
    this._repo = repo;
    if (!this._flushTimer) {
      this._flushTimer = setInterval(() => void this._flush(), FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Record a completed AI request.
   * This method is synchronous — it never blocks the request path.
   */
  record(params: {
    tenantId: string;
    userId: string;
    feature: string;
    model: string;
    provider: AIProvider;
    usage: TokenUsage;
    latencyMs: number;
    success: boolean;
    errorCode?: string;
  }): void {
    const entry: AIUsageRecord = {
      requestId: randomUUID(),
      createdAt: new Date(),
      ...params,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
    };

    this._buffer.push(entry);

    logger.debug(
      {
        feature: entry.feature,
        model: entry.model,
        totalTokens: entry.totalTokens,
        latencyMs: entry.latencyMs,
        success: entry.success,
      },
      '[TokenUsage] Recorded'
    );

    if (this._buffer.length >= BUFFER_MAX) {
      void this._flush();
    }
  }

  /** Aggregate usage for a tenant (in-memory only — for quick dashboards). */
  summarize(tenantId: string): {
    totalRequests: number;
    totalTokens: number;
    avgLatencyMs: number;
  } {
    const records = this._buffer.filter((r) => r.tenantId === tenantId);
    const totalTokens = records.reduce((s, r) => s + r.totalTokens, 0);
    const avgLatencyMs = records.length > 0
      ? records.reduce((s, r) => s + r.latencyMs, 0) / records.length
      : 0;

    return { totalRequests: records.length, totalTokens, avgLatencyMs };
  }

  /** Graceful shutdown — flush pending records. */
  async shutdown(): Promise<void> {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    await this._flush();
  }

  private async _flush(): Promise<void> {
    if (this._buffer.length === 0) return;

    const batch = this._buffer.splice(0, this._buffer.length);

    if (this._repo) {
      try {
        await this._repo.insertMany(batch);
        logger.debug({ count: batch.length }, '[TokenUsage] Flushed to repository');
      } catch (error) {
        logger.error({ error, count: batch.length }, '[TokenUsage] Flush failed — records dropped');
      }
    } else {
      // Fallback: structured log so records aren't lost
      for (const record of batch) {
        logger.info({ aiUsage: record }, '[TokenUsage] Log-only mode');
      }
    }
  }
}

export const tokenUsageTracker = new TokenUsageTracker();
