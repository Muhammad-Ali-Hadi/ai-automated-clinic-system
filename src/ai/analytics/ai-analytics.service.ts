/**
 * @module ai/analytics/ai-analytics.service
 * @description Aggregated analytics service for AI usage reporting per tenant.
 * Provides cost estimation, latency trends, and feature-level breakdowns.
 */

import type { AIUsageRecord } from '../types/ai.types.js';
import type { AIModel } from '../types/ai.types.js';
import { estimateCostUsd } from '../config/model-registry.js';
import { logger } from '../../lib/logger.js';

export interface AIAnalyticsSummary {
  tenantId: string;
  period: { from: Date; to: Date };
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  byFeature: Record<string, { requests: number; tokens: number; costUsd: number }>;
  byModel: Record<string, { requests: number; tokens: number; costUsd: number }>;
}

/**
 * Computes aggregated analytics from an array of usage records.
 * This is a pure computation service — the caller is responsible for supplying records
 * (from MongoDB, Redis, or any other source).
 */
export class AIAnalyticsService {
  summarize(tenantId: string, records: AIUsageRecord[], period: { from: Date; to: Date }): AIAnalyticsSummary {
    const filtered = records.filter(
      (r) => r.tenantId === tenantId && r.createdAt >= period.from && r.createdAt <= period.to
    );

    const totalRequests = filtered.length;
    const successfulRequests = filtered.filter((r) => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalTokens = filtered.reduce((s, r) => s + r.totalTokens, 0);

    let estimatedCostUsd = 0;
    const byFeature: AIAnalyticsSummary['byFeature'] = {};
    const byModel: AIAnalyticsSummary['byModel'] = {};
    const latencies: number[] = [];

    for (const r of filtered) {
      let costUsd = 0;
      try {
        costUsd = estimateCostUsd(r.model as AIModel, r.promptTokens, r.completionTokens);
      } catch {
        // Unknown model — skip cost estimation
      }
      estimatedCostUsd += costUsd;
      latencies.push(r.latencyMs);

      // Feature breakdown
      if (!byFeature[r.feature]) byFeature[r.feature] = { requests: 0, tokens: 0, costUsd: 0 };
      byFeature[r.feature]!.requests++;
      byFeature[r.feature]!.tokens += r.totalTokens;
      byFeature[r.feature]!.costUsd += costUsd;

      // Model breakdown
      if (!byModel[r.model]) byModel[r.model] = { requests: 0, tokens: 0, costUsd: 0 };
      byModel[r.model]!.requests++;
      byModel[r.model]!.tokens += r.totalTokens;
      byModel[r.model]!.costUsd += costUsd;
    }

    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((s, l) => s + l, 0) / latencies.length
      : 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

    logger.debug({ tenantId, totalRequests, estimatedCostUsd }, '[AIAnalytics] Summary computed');

    return {
      tenantId,
      period,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      estimatedCostUsd: Math.round(estimatedCostUsd * 10_000) / 10_000,
      avgLatencyMs: Math.round(avgLatencyMs),
      p95LatencyMs,
      byFeature,
      byModel,
    };
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
