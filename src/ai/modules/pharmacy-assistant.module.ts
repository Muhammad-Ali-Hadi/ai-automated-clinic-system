/**
 * @module ai/modules/pharmacy-assistant.module
 * @description AI Pharmacy Assistant Module — Drug interaction detection, duplicate meds, and inventory replenishment forecasting.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';

export type PharmacyAction =
  | 'explain_medicine'
  | 'medicine_instructions'
  | 'check_interactions'
  | 'check_duplicates'
  | 'inventory_replenishment'
  | 'inventory_forecast';

export interface PharmacyAssistantInput {
  tenantId: string;
  userId: string;
  action: PharmacyAction;
  medicationsList: string;
  currentInventory?: string;
}

export interface InteractionFlag {
  med1: string;
  med2: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  detail: string;
}

export interface InventoryForecast {
  item: string;
  currentStock: number;
  reorderRecommendation: number;
  reason: string;
}

export interface PharmacyAssistantResult {
  medicationInstructions: string[];
  interactionFlags: InteractionFlag[];
  duplicateFlags: string[];
  inventoryForecast: InventoryForecast[];
  latencyMs: number;
}

export class AIPharmacyAssistantModule {
  async processPharmacyTask(input: PharmacyAssistantInput): Promise<PharmacyAssistantResult> {
    const startMs = Date.now();

    const messages = promptManager.render('ai-pharmacy-assistant', {
      PHARMACY_ACTION: input.action,
      MEDICATIONS_LIST: input.medicationsList,
      CURRENT_INVENTORY: input.currentInventory ?? 'No stock context provided',
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<PharmacyAssistantResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        medicationInstructions: [result.content],
        interactionFlags: [],
        duplicateFlags: [],
        inventoryForecast: [],
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: `pharmacy-assistant:${input.action}`,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      medicationInstructions: parsed.medicationInstructions ?? [],
      interactionFlags: parsed.interactionFlags ?? [],
      duplicateFlags: parsed.duplicateFlags ?? [],
      inventoryForecast: parsed.inventoryForecast ?? [],
      latencyMs,
    };
  }
}

export const aiPharmacyAssistantModule = new AIPharmacyAssistantModule();
