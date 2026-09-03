/**
 * @module ai/modules/token-management.module
 * @description Token Management Module — Cost estimation, per-tenant usage analytics, and quota enforcement.
 */

import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { aiAnalyticsService } from '../analytics/ai-analytics.service.js';
import { estimateCostUsd, getModelConfig } from '../config/model-registry.js';
import type { AIModel } from '../types/ai.types.js';

export interface TenantQuotaCheck {
  tenantId: string;
  dailyLimitTokens: number;
  tokensUsedToday: number;
  limitExceeded: boolean;
  estimatedCostUsd: number;
}

export class TokenManagementModule {
  /** Record raw token usage */
  recordUsage(params: Parameters<typeof tokenUsageTracker.record>[0]) {
    tokenUsageTracker.record(params);
  }

  /** Calculate exact cost in USD for a request */
  calculateCost(model: AIModel, promptTokens: number, completionTokens: number): number {
    return estimateCostUsd(model, promptTokens, completionTokens);
  }

  /** Check tenant quota limits against buffer summaries */
  checkTenantQuota(tenantId: string, dailyLimitTokens: number = 500_000): TenantQuotaCheck {
    const summary = tokenUsageTracker.summarize(tenantId);
    const limitExceeded = summary.totalTokens >= dailyLimitTokens;

    // Estimate cost using default model config as baseline
    const modelCfg = getModelConfig('gpt-4.1-mini');
    const estimatedCostUsd = (summary.totalTokens / 1_000_000) * modelCfg.costPerMillionPromptTokens;

    return {
      tenantId,
      dailyLimitTokens,
      tokensUsedToday: summary.totalTokens,
      limitExceeded,
      estimatedCostUsd: Math.round(estimatedCostUsd * 10_000) / 10_000,
    };
  }

  /** Aggregate usage stats across a period */
  getAnalyticsSummary(tenantId: string, records: Parameters<typeof aiAnalyticsService.summarize>[1], period: { from: Date; to: Date }) {
    return aiAnalyticsService.summarize(tenantId, records, period);
  }
}

export const tokenManagementModule = new TokenManagementModule();
