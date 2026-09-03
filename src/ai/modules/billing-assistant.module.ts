/**
 * @module ai/modules/billing-assistant.module
 * @description AI Billing Assistant Module — Invoice explanations, duplicate billing detection, and claim assistance.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';

export type BillingAction =
  | 'explain_invoice'
  | 'summarize_balance'
  | 'detect_duplicates'
  | 'suggest_corrections'
  | 'insurance_claim_help'
  | 'generate_summary'
  | 'payment_reminder';

export interface BillingAssistantInput {
  tenantId: string;
  userId: string;
  action: BillingAction;
  invoiceData: string;
  paymentHistory?: string;
}

export interface BillingAssistantResult {
  summary: string;
  duplicateWarnings: string[];
  corrections: string[];
  insuranceClaimNotes: string;
  paymentReminderText: string;
  latencyMs: number;
}

export class AIBillingAssistantModule {
  async processBillingTask(input: BillingAssistantInput): Promise<BillingAssistantResult> {
    const startMs = Date.now();

    const messages = promptManager.render('ai-billing-assistant', {
      BILLING_ACTION: input.action,
      INVOICE_DATA: input.invoiceData,
      PAYMENT_HISTORY: input.paymentHistory ?? 'No previous billing history provided',
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<BillingAssistantResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        summary: result.content,
        duplicateWarnings: [],
        corrections: [],
        insuranceClaimNotes: '',
        paymentReminderText: '',
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: `billing-assistant:${input.action}`,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      summary: parsed.summary ?? result.content,
      duplicateWarnings: parsed.duplicateWarnings ?? [],
      corrections: parsed.corrections ?? [],
      insuranceClaimNotes: parsed.insuranceClaimNotes ?? '',
      paymentReminderText: parsed.paymentReminderText ?? '',
      latencyMs,
    };
  }
}

export const aiBillingAssistantModule = new AIBillingAssistantModule();
