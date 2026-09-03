/**
 * @module ai/modules/smart-search.module
 * @description Smart Search Module — Converts natural language to structured query JSON with RBAC & tenant isolation.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';

export interface SmartSearchInput {
  tenantId: string;
  userId: string;
  userRole: string;
  naturalLanguageQuery: string;
}

export interface SmartSearchResult {
  targetModule: 'appointments' | 'invoices' | 'patients' | 'lab_reports' | 'inventory';
  filterQuery: Record<string, unknown>;
  sort: Record<string, unknown>;
  limit: number;
  explanation: string;
  tenantEnforced: boolean;
  latencyMs: number;
}

export class SmartSearchModule {
  async parseQuery(input: SmartSearchInput): Promise<SmartSearchResult> {
    const startMs = Date.now();

    const messages = promptManager.render('smart-search', {
      NATURAL_LANGUAGE_QUERY: input.naturalLanguageQuery,
      USER_ROLE: input.userRole,
      TENANT_ID: input.tenantId,
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<SmartSearchResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        targetModule: 'appointments',
        filterQuery: {},
        sort: { createdAt: 'desc' },
        limit: 20,
        explanation: 'Default fallback query',
      };
    }

    // Force tenant isolation inside the parsed filter query
    const filterQuery = { ...(parsed.filterQuery ?? {}), tenantId: input.tenantId };

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'smart-search',
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      targetModule: parsed.targetModule ?? 'appointments',
      filterQuery,
      sort: parsed.sort ?? { createdAt: 'desc' },
      limit: parsed.limit ?? 25,
      explanation: parsed.explanation ?? 'Natural language parsed',
      tenantEnforced: true,
      latencyMs,
    };
  }
}

export const smartSearchModule = new SmartSearchModule();
