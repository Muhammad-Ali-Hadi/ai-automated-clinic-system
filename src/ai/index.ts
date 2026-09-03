/**
 * @module ai/index
 * @description Public barrel export for all 15 Rizocare AI Modules and Production Infrastructure.
 * Import AI capabilities exclusively through this file in business logic.
 *
 * ⚠️  Never import individual AI service files directly from controllers or routes.
 *      Use `aiService` from this module as the single entry point.
 */

// Gateway — single entry point
export { aiService } from './services/ai.service.js';
export type {
  ClinicalChatInput,
  DischargeInput,
  LabInterpretationInput,
  PrescriptionInput,
} from './services/ai.service.js';

// ── 15 Specialized AI Modules ────────────────────────────────────────────────
export { aiReceptionistModule, AIReceptionistModule } from './modules/receptionist.module.js';
export type { ReceptionistRequest, ReceptionistResponse } from './modules/receptionist.module.js';

export { aiDoctorAssistantModule, AIDoctorAssistantModule } from './modules/doctor-assistant.module.js';
export type { DoctorAssistantInput, DoctorAssistantResult, DoctorTaskType } from './modules/doctor-assistant.module.js';

export { aiPatientAssistantModule, AIPatientAssistantModule } from './modules/patient-assistant.module.js';
export type { PatientAssistantInput, PatientAssistantResult } from './modules/patient-assistant.module.js';

export { aiBillingAssistantModule, AIBillingAssistantModule } from './modules/billing-assistant.module.js';
export type { BillingAssistantInput, BillingAssistantResult, BillingAction } from './modules/billing-assistant.module.js';

export { aiLabAssistantModule, AILabAssistantModule } from './modules/lab-assistant.module.js';
export type { LabAssistantInput, LabAssistantResult, AbnormalValueFlag } from './modules/lab-assistant.module.js';

export { aiPharmacyAssistantModule, AIPharmacyAssistantModule } from './modules/pharmacy-assistant.module.js';
export type { PharmacyAssistantInput, PharmacyAssistantResult, PharmacyAction, InteractionFlag, InventoryForecast } from './modules/pharmacy-assistant.module.js';

export { aiVoiceAssistantModule, AIVoiceAssistantModule } from './modules/voice-assistant.module.js';
export type { VoiceProcessInput, VoiceProcessResult } from './modules/voice-assistant.module.js';

export { medicalDocumentAIModule, MedicalDocumentAIModule } from './modules/document-ai.module.js';
export type { DocumentAIInput, DocumentAIResult, ExtractedLabValue } from './modules/document-ai.module.js';

export { aiKnowledgeAssistantModule, AIKnowledgeAssistantModule } from './modules/knowledge-assistant.module.js';
export type { KnowledgeQueryInput, KnowledgeQueryResult } from './modules/knowledge-assistant.module.js';

export { aiAnalyticsEngineModule, AIAnalyticsEngineModule } from './modules/analytics-engine.module.js';
export type { AnalyticsEngineInput, AnalyticsEngineResult, RevenueForecast } from './modules/analytics-engine.module.js';

export { smartSearchModule, SmartSearchModule } from './modules/smart-search.module.js';
export type { SmartSearchInput, SmartSearchResult } from './modules/smart-search.module.js';

export { aiNotificationEngineModule, AINotificationEngineModule } from './modules/notification-engine.module.js';
export type { NotificationEngineInput, NotificationEngineResult, NotificationType } from './modules/notification-engine.module.js';

export { conversationMemoryModule, ConversationMemoryModule } from './modules/conversation-memory.module.js';

export { promptManagementModule, PromptManagementModule } from './modules/prompt-management.module.js';
export type { PromptTestResult } from './modules/prompt-management.module.js';

export { tokenManagementModule, TokenManagementModule } from './modules/token-management.module.js';
export type { TenantQuotaCheck } from './modules/token-management.module.js';

// Production Operations, Guardrails & Evaluation Framework
export { aiGuardrails, AIGuardrails } from './guardrails/ai-guardrails.js';
export type { GuardrailValidationResult, SecurityContext } from './guardrails/ai-guardrails.js';

export { benchmarkRunner, BenchmarkRunner } from './evaluations/benchmark-runner.js';
export type { BenchmarkTestCase, BenchmarkResult, SuiteSummary } from './evaluations/benchmark-runner.js';

// Core Framework & Infrastructure Exports
export { clinicalAssistantAgent } from './agents/clinical-assistant.agent.js';
export type { AgentContext, AgentResponse, ClinicalIntent } from './agents/clinical-assistant.agent.js';

export { ragService } from './rag/rag.service.js';
export type { RAGIngestOptions, RAGQueryResult } from './rag/rag.service.js';

export { speechService } from './services/speech.service.js';
export { tokenUsageTracker } from './analytics/token-usage-tracker.js';
export { aiAnalyticsService } from './analytics/ai-analytics.service.js';
export type { AIAnalyticsSummary } from './analytics/ai-analytics.service.js';

export { runDocumentIngestWorkflow } from './workflows/document-ingest.workflow.js';
export type { DocumentIngestPayload, DocumentIngestResult } from './workflows/document-ingest.workflow.js';

export { MEDICAL_CALCULATOR_TOOLS, calculateBMI, calculateEGFR, calculateBSA } from './tools/medical-calculator.tool.js';
export { evaluateAIResponse } from './evaluations/ai-response-evaluator.js';
export type { EvaluationResult } from './evaluations/ai-response-evaluator.js';

export type * from './types/ai.types.js';
export { aiEnv } from './config/ai-env.js';
export { MODEL_REGISTRY, getModelConfig, getFallbackModel, estimateCostUsd } from './config/model-registry.js';
