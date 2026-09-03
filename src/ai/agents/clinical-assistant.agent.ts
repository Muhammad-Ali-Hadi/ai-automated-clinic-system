/**
 * @module ai/agents/clinical-assistant.agent
 * @description LangGraph-style stateful clinical assistant agent.
 * Implements a multi-step reasoning graph: classify → route → respond → review.
 *
 * This agent wraps the AIService for complex multi-step clinical workflows
 * and is the recommended pattern for agentic features.
 */

import type { ChatMessage } from '../types/ai.types.js';
import { aiService } from '../services/ai.service.js';
import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { logger } from '../../lib/logger.js';

export type ClinicalIntent =
  | 'discharge_summary'
  | 'lab_interpretation'
  | 'prescription_draft'
  | 'general_query'
  | 'knowledge_search'
  | 'unknown';

export interface AgentContext {
  tenantId: string;
  userId: string;
  sessionId?: string;
  patientId?: string;
  hospitalName?: string;
  department?: string;
  clinicianRole?: string;
}

export interface AgentResponse {
  intent: ClinicalIntent;
  content: string;
  isDraft: boolean;
  requiresReview: boolean;
  latencyMs: number;
  stepsExecuted: string[];
}

const INTENT_CLASSIFIER_PROMPT = `You are a clinical intent classifier.
Given a clinician's input, classify it into exactly one of these intents:
- discharge_summary: Generating or drafting a discharge summary
- lab_interpretation: Interpreting lab results or blood work
- prescription_draft: Suggesting a prescription or medication
- knowledge_search: Looking up medical guidelines, drug info, or clinical protocols
- general_query: General clinical question or conversation

Respond with JSON only: { "intent": "<intent>", "confidence": <0-1> }`;

export class ClinicalAssistantAgent {
  /**
   * Entry point for the clinical assistant agent.
   * Classifies intent then routes to the appropriate AI capability.
   */
  async run(userInput: string, context: AgentContext): Promise<AgentResponse> {
    const startMs = Date.now();
    const stepsExecuted: string[] = [];

    // Step 1: Classify Intent
    stepsExecuted.push('classify_intent');
    const intent = await this._classifyIntent(userInput);
    logger.info({ intent, tenantId: context.tenantId }, '[ClinicalAgent] Intent classified');

    // Step 2: Route to capability
    stepsExecuted.push(`route:${intent}`);
    let content: string;
    let isDraft = false;
    let requiresReview = true;

    switch (intent) {
      case 'discharge_summary':
        content = await this._handleDischargeSummary(userInput, context);
        isDraft = true;
        break;

      case 'lab_interpretation':
        content = await this._handleLabInterpretation(userInput, context);
        isDraft = true;
        break;

      case 'prescription_draft':
        content = await this._handlePrescriptionDraft(userInput, context);
        isDraft = true;
        break;

      case 'knowledge_search': {
        const result = await aiService.medicalKnowledgeQuery({
          tenantId: context.tenantId,
          userId: context.userId,
          question: userInput,
        });
        content = result.content;
        requiresReview = false;
        break;
      }

      default:
        // Fallback: general clinical chat
        stepsExecuted.push('general_chat');
        const chatResult = await aiService.clinicalChat({
          tenantId: context.tenantId,
          userId: context.userId,
          sessionId: context.sessionId,
          patientId: context.patientId,
          userMessage: userInput,
          hospitalName: context.hospitalName,
          department: context.department,
          clinicianRole: context.clinicianRole,
          wrapAsDraft: false,
        });
        content = chatResult.content;
        requiresReview = false;
        break;
    }

    const latencyMs = Date.now() - startMs;
    logger.info({ intent, latencyMs, stepsExecuted }, '[ClinicalAgent] Run complete');

    return { intent, content, isDraft, requiresReview, latencyMs, stepsExecuted };
  }

  // ── Private Steps ─────────────────────────────────────────────────────────

  private async _classifyIntent(userInput: string): Promise<ClinicalIntent> {
    const messages: ChatMessage[] = [
      { role: 'system', content: INTENT_CLASSIFIER_PROMPT },
      { role: 'user', content: userInput.slice(0, 500) },
    ];

    try {
      const result = await chatService.complete(messages, {
        temperature: 0,
        maxTokens: 100,
        jsonMode: true,
      });
      const parsed = JSON.parse(result.content) as { intent: ClinicalIntent };
      return parsed.intent ?? 'general_query';
    } catch {
      return 'general_query';
    }
  }

  private async _handleDischargeSummary(
    userInput: string,
    context: AgentContext
  ): Promise<string> {
    // In a full implementation, these would be extracted from the session/patient record.
    // Here we pass the raw input as clinical notes for the draft.
    const result = await aiService.generateDischargeSummary({
      tenantId: context.tenantId,
      userId: context.userId,
      patientAge: 'Not specified',
      patientGender: 'Not specified',
      admissionDate: 'Not specified',
      dischargeDate: 'Not specified',
      clinicalNotes: userInput,
      medications: 'Not specified',
      procedures: 'Not specified',
    });
    return result.content;
  }

  private async _handleLabInterpretation(
    userInput: string,
    context: AgentContext
  ): Promise<string> {
    const result = await aiService.interpretLabResults({
      tenantId: context.tenantId,
      userId: context.userId,
      labResults: userInput,
      patientContext: 'Provided in session',
    });
    return result.content;
  }

  private async _handlePrescriptionDraft(
    userInput: string,
    context: AgentContext
  ): Promise<string> {
    const result = await aiService.draftPrescription({
      tenantId: context.tenantId,
      userId: context.userId,
      diagnosis: userInput,
      patientAge: 'Not specified',
      patientGender: 'Not specified',
      allergies: 'None known',
      currentMedications: 'None',
      weightKg: 'Not specified',
    });
    return result.content;
  }
}

export const clinicalAssistantAgent = new ClinicalAssistantAgent();
