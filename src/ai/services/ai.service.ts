/**
 * @module ai/services/ai.service
 * @description Centralized AI Service Gateway — the ONLY entry point for all AI calls
 * from business logic. Controllers never call chat/embedding/RAG services directly.
 */

import type {
  AIServiceResponse,
  CompletionOptions,
  ChatMessage,
} from '../types/ai.types.js';
import { chatService } from './chat.service.js';
import { conversationManager } from '../memory/conversation-manager.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { ragService } from '../rag/rag.service.js';
import { speechService } from './speech.service.js';
import { sanitizeUserInput, wrapAsDraft } from '../utils/sanitize.js';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';
import type { TranscriptionResult, SpeechOptions } from '../types/ai.types.js';

// Import all 15 AI modules
import { aiReceptionistModule } from '../modules/receptionist.module.js';
import { aiDoctorAssistantModule } from '../modules/doctor-assistant.module.js';
import { aiPatientAssistantModule } from '../modules/patient-assistant.module.js';
import { aiBillingAssistantModule } from '../modules/billing-assistant.module.js';
import { aiLabAssistantModule } from '../modules/lab-assistant.module.js';
import { aiPharmacyAssistantModule } from '../modules/pharmacy-assistant.module.js';
import { aiVoiceAssistantModule } from '../modules/voice-assistant.module.js';
import { medicalDocumentAIModule } from '../modules/document-ai.module.js';
import { aiKnowledgeAssistantModule } from '../modules/knowledge-assistant.module.js';
import { aiAnalyticsEngineModule } from '../modules/analytics-engine.module.js';
import { smartSearchModule } from '../modules/smart-search.module.js';
import { aiNotificationEngineModule } from '../modules/notification-engine.module.js';
import { conversationMemoryModule } from '../modules/conversation-memory.module.js';
import { promptManagementModule } from '../modules/prompt-management.module.js';
import { tokenManagementModule } from '../modules/token-management.module.js';

export interface ClinicalChatInput {
  tenantId: string;
  userId: string;
  sessionId?: string;
  patientId?: string;
  userMessage: string;
  hospitalName?: string;
  department?: string;
  clinicianRole?: string;
  wrapAsDraft?: boolean;
}

export interface DischargeInput {
  tenantId: string;
  userId: string;
  patientAge: string;
  patientGender: string;
  admissionDate: string;
  dischargeDate: string;
  clinicalNotes: string;
  medications: string;
  procedures: string;
}

export interface LabInterpretationInput {
  tenantId: string;
  userId: string;
  labResults: string;
  patientContext: string;
}

export interface PrescriptionInput {
  tenantId: string;
  userId: string;
  diagnosis: string;
  patientAge: string;
  patientGender: string;
  allergies: string;
  currentMedications: string;
  weightKg: string;
}

export class AIService {
  // ── 15 AI Sub-module Gateway References ────────────────────────────────────
  public readonly receptionist = aiReceptionistModule;
  public readonly doctorAssistant = aiDoctorAssistantModule;
  public readonly patientAssistant = aiPatientAssistantModule;
  public readonly billingAssistant = aiBillingAssistantModule;
  public readonly labAssistant = aiLabAssistantModule;
  public readonly pharmacyAssistant = aiPharmacyAssistantModule;
  public readonly voiceAssistant = aiVoiceAssistantModule;
  public readonly documentAI = medicalDocumentAIModule;
  public readonly knowledgeAssistant = aiKnowledgeAssistantModule;
  public readonly analyticsEngine = aiAnalyticsEngineModule;
  public readonly smartSearch = smartSearchModule;
  public readonly notificationEngine = aiNotificationEngineModule;
  public readonly conversationMemory = conversationMemoryModule;
  public readonly promptManagement = promptManagementModule;
  public readonly tokenManagement = tokenManagementModule;

  // ── Clinical Chat ──────────────────────────────────────────────────────────

  /**
   * Stateful multi-turn clinical chat with memory management.
   */
  async clinicalChat(input: ClinicalChatInput): Promise<AIServiceResponse> {
    const sanitized = sanitizeUserInput(input.userMessage);

    const session = await conversationManager.getOrCreate(
      input.tenantId,
      input.userId,
      input.patientId,
      input.sessionId
    );

    const systemMsg = promptManager.renderSystem('clinical-chat', {
      HOSPITAL_NAME: input.hospitalName ?? 'Rizocare Hospital',
      DEPARTMENT: input.department ?? 'General',
      CLINICIAN_ROLE: input.clinicianRole ?? 'Clinician',
    });

    const userMsg: ChatMessage = { role: 'user', content: sanitized };
    const updatedSession = await conversationManager.append(session, userMsg);
    const messages = conversationManager.getMessages(updatedSession, systemMsg);

    const result = await chatService.complete(messages, { temperature: aiEnv.AI_TEMPERATURE });

    // Persist assistant reply
    await conversationManager.append(updatedSession, {
      role: 'assistant',
      content: result.content,
    });

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'clinical-chat',
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs: result.latencyMs,
      success: true,
    });

    logger.info(
      { tenantId: input.tenantId, latencyMs: result.latencyMs },
      '[AIService] clinicalChat complete'
    );

    return {
      content: input.wrapAsDraft !== false ? wrapAsDraft(result.content, 'Clinical Chat') : result.content,
      usage: result.usage,
      latencyMs: result.latencyMs,
      model: result.model,
      provider: result.provider,
      requestId: session.sessionId,
    };
  }

  // ── Discharge Summary ──────────────────────────────────────────────────────

  async generateDischargeSummary(input: DischargeInput): Promise<AIServiceResponse> {
    const messages = promptManager.render('discharge-summary', {
      PATIENT_AGE: input.patientAge,
      PATIENT_GENDER: input.patientGender,
      ADMISSION_DATE: input.admissionDate,
      DISCHARGE_DATE: input.dischargeDate,
      CLINICAL_NOTES: sanitizeUserInput(input.clinicalNotes),
      MEDICATIONS: input.medications,
      PROCEDURES: input.procedures,
    });

    return this._runAndTrack(messages, input.tenantId, input.userId, 'discharge-summary');
  }

  // ── Lab Interpretation ─────────────────────────────────────────────────────

  async interpretLabResults(input: LabInterpretationInput): Promise<AIServiceResponse> {
    const messages = promptManager.render('lab-interpretation', {
      LAB_RESULTS: sanitizeUserInput(input.labResults),
      PATIENT_CONTEXT: sanitizeUserInput(input.patientContext),
    });

    return this._runAndTrack(messages, input.tenantId, input.userId, 'lab-interpretation', {
      jsonMode: true,
    });
  }

  // ── Prescription Draft ─────────────────────────────────────────────────────

  async draftPrescription(input: PrescriptionInput): Promise<AIServiceResponse> {
    const messages = promptManager.render('prescription-draft', {
      DIAGNOSIS: sanitizeUserInput(input.diagnosis),
      PATIENT_AGE: input.patientAge,
      PATIENT_GENDER: input.patientGender,
      ALLERGIES: input.allergies,
      CURRENT_MEDICATIONS: input.currentMedications,
      WEIGHT_KG: input.weightKg,
    });

    return this._runAndTrack(messages, input.tenantId, input.userId, 'prescription-draft', {
      jsonMode: true,
    });
  }

  // ── RAG Medical Q&A ────────────────────────────────────────────────────────

  async medicalKnowledgeQuery(params: {
    tenantId: string;
    userId: string;
    question: string;
    collectionName?: string;
  }): Promise<AIServiceResponse & { retrievedChunks: number }> {
    const result = await ragService.query(
      sanitizeUserInput(params.question),
      {
        collectionName: params.collectionName ?? aiEnv.QDRANT_DEFAULT_COLLECTION,
        filter: { tenantId: params.tenantId },
      }
    );

    tokenUsageTracker.record({
      tenantId: params.tenantId,
      userId: params.userId,
      feature: 'rag-medical-qa',
      model: aiEnv.GROQ_DEFAULT_MODEL,
      provider: 'groq',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: result.latencyMs,
      success: true,
    });

    return {
      content: result.answer,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: result.latencyMs,
      model: aiEnv.GROQ_DEFAULT_MODEL,
      provider: 'groq',
      requestId: crypto.randomUUID(),
      retrievedChunks: result.retrievedChunks.length,
    };
  }

  // ── Speech to Text ─────────────────────────────────────────────────────────

  async transcribeAudio(
    tenantId: string,
    userId: string,
    audioBuffer: Buffer,
    filename: string,
    options?: SpeechOptions
  ): Promise<TranscriptionResult & { latencyMs: number }> {
    const startMs = Date.now();
    const result = await speechService.transcribe(audioBuffer, filename, options);
    const latencyMs = Date.now() - startMs;

    tokenUsageTracker.record({
      tenantId,
      userId,
      feature: 'speech-to-text',
      model: aiEnv.GROQ_WHISPER_MODEL,
      provider: 'groq',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs,
      success: true,
    });

    return { ...result, latencyMs };
  }

  // ── Private Helper ─────────────────────────────────────────────────────────

  private async _runAndTrack(
    messages: ChatMessage[],
    tenantId: string,
    userId: string,
    feature: string,
    options: CompletionOptions = {}
  ): Promise<AIServiceResponse> {
    const { randomUUID } = await import('node:crypto');
    const requestId = randomUUID();

    try {
      const result = await chatService.complete(messages, options);

      tokenUsageTracker.record({
        tenantId,
        userId,
        feature,
        model: result.model,
        provider: result.provider,
        usage: result.usage,
        latencyMs: result.latencyMs,
        success: true,
      });

      logger.info({ feature, tenantId, latencyMs: result.latencyMs }, '[AIService] Feature complete');

      return {
        content: result.content,
        usage: result.usage,
        latencyMs: result.latencyMs,
        model: result.model,
        provider: result.provider,
        requestId,
      };
    } catch (error) {
      const errCode = (error as { code?: string }).code ?? 'UNKNOWN';
      tokenUsageTracker.record({
        tenantId,
        userId,
        feature,
        model: aiEnv.GROQ_DEFAULT_MODEL,
        provider: 'groq',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 0,
        success: false,
        errorCode: errCode,
      });
      throw error;
    }
  }
}

/** Shared singleton AI service gateway. */
export const aiService = new AIService();
