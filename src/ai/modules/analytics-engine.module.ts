/**
 * @module ai/modules/analytics-engine.module
 * @description AI Analytics Engine Module — Revenue forecasting, workload analysis, peak-hour prediction, and recommendations.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';

export interface AnalyticsEngineInput {
  tenantId: string;
  userId: string;
  analysisPeriod: string;
  metricsData: string;
}

export interface RevenueForecast {
  trend: string;
  projectedGrowthPercent: number;
}

export interface AnalyticsEngineResult {
  executiveSummary: string;
  revenueForecast: RevenueForecast;
  peakHourPrediction: string;
  workloadAlerts: string[];
  operationalRecommendations: string[];
  latencyMs: number;
}

export class AIAnalyticsEngineModule {
  async generateOperationalAnalytics(input: AnalyticsEngineInput): Promise<AnalyticsEngineResult> {
    const startMs = Date.now();

    const messages = promptManager.render('ai-analytics-engine', {
      ANALYSIS_PERIOD: input.analysisPeriod,
      METRICS_DATA: input.metricsData,
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<AnalyticsEngineResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        executiveSummary: result.content,
        revenueForecast: { trend: 'Stable', projectedGrowthPercent: 0 },
        peakHourPrediction: '10:00 AM - 1:00 PM',
        workloadAlerts: [],
        operationalRecommendations: [result.content],
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'ai-analytics-engine',
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      executiveSummary: parsed.executiveSummary ?? result.content,
      revenueForecast: parsed.revenueForecast ?? { trend: 'Stable', projectedGrowthPercent: 0 },
      peakHourPrediction: parsed.peakHourPrediction ?? '10:00 AM - 2:00 PM',
      workloadAlerts: parsed.workloadAlerts ?? [],
      operationalRecommendations: parsed.operationalRecommendations ?? [],
      latencyMs,
    };
  }
}

export const aiAnalyticsEngineModule = new AIAnalyticsEngineModule();
