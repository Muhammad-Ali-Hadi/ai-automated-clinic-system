/**
 * @module ai/modules/lab-assistant.module
 * @description AI Laboratory Assistant Module — Report explanations, abnormal value highlighting, and trend comparison.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { sanitizeUserInput } from '../utils/sanitize.js';

export interface LabAssistantInput {
  tenantId: string;
  userId: string;
  patientAgeGender?: string;
  currentReport: string;
  historicalReports?: string;
}

export interface AbnormalValueFlag {
  parameter: string;
  value: string;
  referenceRange: string;
  flag: 'LOW' | 'HIGH' | 'CRITICAL';
}

export interface LabAssistantResult {
  reportSummary: string;
  abnormalValues: AbnormalValueFlag[];
  trendComparison: string;
  patientFriendlyExplanation: string;
  disclaimer: string;
  latencyMs: number;
}

export class AILabAssistantModule {
  async analyzeLabReport(input: LabAssistantInput): Promise<LabAssistantResult> {
    const startMs = Date.now();

    const messages = promptManager.render('ai-lab-assistant', {
      PATIENT_AGE_GENDER: input.patientAgeGender ?? 'Unspecified Age/Gender',
      CURRENT_REPORT: sanitizeUserInput(input.currentReport),
      HISTORICAL_REPORTS: sanitizeUserInput(input.historicalReports ?? 'No historical lab records available'),
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<LabAssistantResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        reportSummary: result.content,
        abnormalValues: [],
        trendComparison: 'Historical comparison unavailable.',
        patientFriendlyExplanation: result.content,
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'lab-assistant',
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      reportSummary: parsed.reportSummary ?? result.content,
      abnormalValues: parsed.abnormalValues ?? [],
      trendComparison: parsed.trendComparison ?? 'No trend changes detected.',
      patientFriendlyExplanation: parsed.patientFriendlyExplanation ?? '',
      disclaimer: 'AI-generated lab analysis is an educational draft. Requires clinical review by the ordering physician.',
      latencyMs,
    };
  }
}

export const aiLabAssistantModule = new AILabAssistantModule();
