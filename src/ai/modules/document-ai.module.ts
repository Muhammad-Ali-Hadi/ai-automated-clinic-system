/**
 * @module ai/modules/document-ai.module
 * @description Medical Document AI Module — Extract diagnoses, medications, lab values, and recommendations into structured JSON.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { sanitizeUserInput } from '../utils/sanitize.js';

export interface DocumentAIInput {
  tenantId: string;
  userId: string;
  documentText: string;
  documentType?: string;
}

export interface ExtractedLabValue {
  testName: string;
  result: string;
  unit: string;
}

export interface DocumentAIResult {
  documentSummary: string;
  extractedDiagnoses: string[];
  extractedMedications: string[];
  extractedAllergies: string[];
  extractedLabValues: ExtractedLabValue[];
  doctorRecommendations: string[];
  confidenceScore: number;
  latencyMs: number;
}

export class MedicalDocumentAIModule {
  async processMedicalDocument(input: DocumentAIInput): Promise<DocumentAIResult> {
    const startMs = Date.now();

    const messages = promptManager.render('medical-document-ai', {
      DOCUMENT_TYPE: input.documentType ?? 'Medical Record PDF/Image Text',
      DOCUMENT_TEXT: sanitizeUserInput(input.documentText),
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<DocumentAIResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        documentSummary: result.content,
        extractedDiagnoses: [],
        extractedMedications: [],
        extractedAllergies: [],
        extractedLabValues: [],
        doctorRecommendations: [],
        confidenceScore: 0.75,
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'medical-document-ai',
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      documentSummary: parsed.documentSummary ?? result.content,
      extractedDiagnoses: parsed.extractedDiagnoses ?? [],
      extractedMedications: parsed.extractedMedications ?? [],
      extractedAllergies: parsed.extractedAllergies ?? [],
      extractedLabValues: parsed.extractedLabValues ?? [],
      doctorRecommendations: parsed.doctorRecommendations ?? [],
      confidenceScore: parsed.confidenceScore ?? 0.85,
      latencyMs,
    };
  }
}

export const medicalDocumentAIModule = new MedicalDocumentAIModule();
