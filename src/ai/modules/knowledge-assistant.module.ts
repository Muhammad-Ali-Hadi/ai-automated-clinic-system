/**
 * @module ai/modules/knowledge-assistant.module
 * @description AI Knowledge Assistant Module — RAG-based search over hospital policies, clinical guidelines, SOPs, and handbooks.
 */

import { ragService } from '../rag/rag.service.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { aiEnv } from '../config/ai-env.js';

export interface KnowledgeQueryInput {
  tenantId: string;
  userId: string;
  userQuery: string;
  categoryFilter?: 'policy' | 'guideline' | 'sop' | 'handbook' | 'faq';
}

export interface KnowledgeQueryResult {
  answer: string;
  sources: Array<{ content: string; metadata: Record<string, unknown>; score: number }>;
  latencyMs: number;
}

export class AIKnowledgeAssistantModule {
  async queryKnowledgeBase(input: KnowledgeQueryInput): Promise<KnowledgeQueryResult> {
    const startMs = Date.now();

    const filter: Record<string, unknown> = { tenantId: input.tenantId };
    if (input.categoryFilter) {
      filter['category'] = input.categoryFilter;
    }

    const ragResult = await ragService.query(
      input.userQuery,
      {
        collectionName: aiEnv.QDRANT_DEFAULT_COLLECTION,
        filter,
        topK: 5,
        scoreThreshold: 0.65,
      }
    );

    const latencyMs = Date.now() - startMs;

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'knowledge-assistant',
      model: aiEnv.OPENAI_DEFAULT_MODEL,
      provider: 'openai',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs,
      success: true,
    });

    return {
      answer: ragResult.answer,
      sources: ragResult.retrievedChunks.map((c) => ({
        content: c.content,
        metadata: c.metadata,
        score: c.score,
      })),
      latencyMs,
    };
  }

  async indexKnowledgeDocument(tenantId: string, content: string, category: string, title: string) {
    return ragService.ingest(content, undefined, {
      metadata: { tenantId, category, title, indexedAt: new Date().toISOString() },
    });
  }
}

export const aiKnowledgeAssistantModule = new AIKnowledgeAssistantModule();
