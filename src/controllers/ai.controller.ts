import type { RequestHandler } from 'express';
import { ok } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';
import { aiService, aiEnv } from '../ai/index.js';
import { getRedisMode } from '../ai/memory/redis-client.js';

/**
 * All fields the AI endpoints may read. Presence of the *required* ones is
 * guaranteed by the per-route Zod schema; declaring them here (not via an index
 * signature) keeps them typed as `string` under `noUncheckedIndexedAccess`.
 * Fields the schema marks optional may be `undefined` at runtime.
 */
interface AiBody {
  message: string;
  sessionId: string;
  patientId: string;
  hospitalName: string;
  department: string;
  clinicianRole: string;
  patientQuery: string;
  doctorSchedules: string;
  hospitalFaqs: string;
  patientLanguage: string;
  patientAge: string;
  patientGender: string;
  admissionDate: string;
  dischargeDate: string;
  clinicalNotes: string;
  medications: string;
  procedures: string;
  labResults: string;
  patientContext: string;
  diagnosis: string;
  allergies: string;
  currentMedications: string;
  weightKg: string;
  currentReport: string;
  patientAgeGender: string;
  historicalReports: string;
  medicalData: string;
  targetLanguage: string;
  action: string;
  invoiceData: string;
  paymentHistory: string;
  medicationsList: string;
  currentInventory: string;
  documentText: string;
  documentType: string;
  naturalLanguageQuery: string;
  analysisPeriod: string;
  metricsData: string;
  question: string;
  collectionName: string;
  content: string;
  title: string;
  category: string;
  audioBase64: string;
  filename: string;
  language: string;
}

/** Does the configured Groq key look like a real one (vs. the repo placeholder)? */
const groqConfigured = (): boolean => {
  const k = aiEnv.GROQ_API_KEY ?? '';
  return k.startsWith('gsk_') && k.length > 24;
};

/** Normalise any failure from the AI layer into a clean HTTP error. */
async function runAI<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string; status?: number }).code;
    const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;

    if (status === 401 || code === 'invalid_api_key' || /api key|apikey|unauthor/i.test(message)) {
      throw new AppError(
        'The AI provider rejected the request. Set a valid GROQ_API_KEY in the server environment.',
        502,
      );
    }
    if (/qdrant|vector|ECONNREFUSED.*6333|fetch failed/i.test(message)) {
      throw new AppError(
        'The vector database (Qdrant) is not reachable. Start Qdrant on QDRANT_URL to use knowledge-base features.',
        503,
      );
    }
    if (/rate limit|429/i.test(message)) throw new AppError('The AI provider is rate limiting. Try again shortly.', 429);
    throw new AppError(`AI request failed: ${message}`, 502);
  }
}

const tenant = (req: Parameters<RequestHandler>[0]) => ({
  tenantId: req.auth!.hospitalId ?? 'system',
  userId: req.auth!.userId,
});

// ── Meta ──────────────────────────────────────────────────────────────────────

export const aiStatus: RequestHandler = async (_req, res) =>
  ok(
    res,
    {
      providers: {
        chat: {
          provider: 'groq',
          configured: groqConfigured(),
          model: aiEnv.GROQ_DEFAULT_MODEL,
          whisperModel: aiEnv.GROQ_WHISPER_MODEL,
        },
        embeddings: {
          provider: 'gemini',
          model: aiEnv.GEMINI_EMBEDDING_MODEL,
        },
      },
      memory: { mode: getRedisMode() },
      vectorStore: { url: aiEnv.QDRANT_URL, collection: aiEnv.QDRANT_DEFAULT_COLLECTION },
      capabilities: [
        'chat',
        'discharge-summary',
        'lab-interpretation',
        'prescription-draft',
        'receptionist',
        'patient-explainer',
        'lab-analysis',
        'billing',
        'pharmacy',
        'document-extraction',
        'smart-search',
        'analytics',
        'knowledge-base',
        'voice-transcription',
      ],
    },
    'AI status',
  );

// ── Conversational ────────────────────────────────────────────────────────────

export const aiChat: RequestHandler = async (req, res) => {
  const { message, sessionId, patientId, hospitalName, department, clinicianRole } = req.body as AiBody;
  const result = await runAI(() =>
    aiService.clinicalChat({
      ...tenant(req),
      sessionId,
      patientId,
      userMessage: message,
      hospitalName,
      department,
      clinicianRole: clinicianRole ?? req.auth!.role,
    }),
  );
  ok(res, result, 'AI response generated.');
};

export const aiReceptionist: RequestHandler = async (req, res) => {
  const { patientQuery, sessionId, doctorSchedules, hospitalFaqs, patientLanguage, hospitalName } = req.body as AiBody;
  const result = await runAI(() =>
    aiService.receptionist.processQuery({
      ...tenant(req),
      sessionId,
      patientQuery,
      doctorSchedules,
      hospitalFaqs,
      patientLanguage,
      hospitalName,
    }),
  );
  ok(res, result, 'Receptionist response generated.');
};

// ── Doctor assistant ──────────────────────────────────────────────────────────

export const aiDischargeSummary: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.generateDischargeSummary({
      ...tenant(req),
      patientAge: b.patientAge,
      patientGender: b.patientGender,
      admissionDate: b.admissionDate,
      dischargeDate: b.dischargeDate,
      clinicalNotes: b.clinicalNotes,
      medications: b.medications ?? '',
      procedures: b.procedures ?? '',
    }),
  );
  ok(res, result, 'Discharge summary drafted.');
};

export const aiLabInterpretation: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.interpretLabResults({ ...tenant(req), labResults: b.labResults, patientContext: b.patientContext ?? '' }),
  );
  ok(res, result, 'Lab results interpreted.');
};

export const aiPrescriptionDraft: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.draftPrescription({
      ...tenant(req),
      diagnosis: b.diagnosis,
      patientAge: b.patientAge,
      patientGender: b.patientGender,
      allergies: b.allergies ?? 'None known',
      currentMedications: b.currentMedications ?? 'None',
      weightKg: b.weightKg ?? '',
    }),
  );
  ok(res, result, 'Prescription draft generated.');
};

export const aiLabAnalysis: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.labAssistant.analyzeLabReport({
      ...tenant(req),
      patientAgeGender: b.patientAgeGender,
      currentReport: b.currentReport,
      historicalReports: b.historicalReports,
    }),
  );
  ok(res, result, 'Lab report analysed.');
};

// ── Patient assistant ─────────────────────────────────────────────────────────

export const aiPatientExplainer: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.patientAssistant.assistPatient({
      ...tenant(req),
      patientQuery: b.patientQuery,
      medicalData: b.medicalData,
      targetLanguage: b.targetLanguage,
    }),
  );
  ok(res, result, 'Patient explanation generated.');
};

// ── Operations ────────────────────────────────────────────────────────────────

export const aiBilling: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.billingAssistant.processBillingTask({
      ...tenant(req),
      action: (b.action as never) ?? 'explain_invoice',
      invoiceData: b.invoiceData,
      paymentHistory: b.paymentHistory,
    }),
  );
  ok(res, result, 'Billing task processed.');
};

export const aiPharmacy: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.pharmacyAssistant.processPharmacyTask({
      ...tenant(req),
      action: (b.action as never) ?? 'check_interactions',
      medicationsList: b.medicationsList,
      currentInventory: b.currentInventory,
    }),
  );
  ok(res, result, 'Pharmacy task processed.');
};

export const aiDocument: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.documentAI.processMedicalDocument({
      ...tenant(req),
      documentText: b.documentText,
      documentType: b.documentType,
    }),
  );
  ok(res, result, 'Document processed.');
};

export const aiSmartSearch: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.smartSearch.parseQuery({
      ...tenant(req),
      userRole: req.auth!.role,
      naturalLanguageQuery: b.naturalLanguageQuery,
    }),
  );
  ok(res, result, 'Query parsed.');
};

export const aiAnalytics: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.analyticsEngine.generateOperationalAnalytics({
      ...tenant(req),
      analysisPeriod: b.analysisPeriod ?? 'last 30 days',
      metricsData: b.metricsData,
    }),
  );
  ok(res, result, 'Analytics generated.');
};

// ── Knowledge base (RAG) ──────────────────────────────────────────────────────

export const aiKnowledgeQuery: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.medicalKnowledgeQuery({ ...tenant(req), question: b.question, collectionName: b.collectionName }),
  );
  ok(res, result, 'Knowledge base queried.');
};

export const aiKnowledgeIngest: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  const result = await runAI(() =>
    aiService.knowledgeAssistant.indexKnowledgeDocument(
      req.auth!.hospitalId ?? 'system',
      b.content,
      b.category ?? 'guideline',
      b.title ?? 'Untitled document',
    ),
  );
  ok(res, result, 'Document indexed.', 201);
};

// ── Voice ─────────────────────────────────────────────────────────────────────

export const aiTranscribe: RequestHandler = async (req, res) => {
  const b = req.body as AiBody;
  if (!b.audioBase64) throw new AppError('audioBase64 is required.', 422);

  const cleaned = b.audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, '');
  const buffer = Buffer.from(cleaned, 'base64');
  if (buffer.length === 0) throw new AppError('Decoded audio is empty.', 422);
  if (buffer.length > 15 * 1024 * 1024) throw new AppError('Audio exceeds the 15 MB limit.', 413);

  const result = await runAI(() =>
    aiService.transcribeAudio(req.auth!.hospitalId ?? 'system', req.auth!.userId, buffer, b.filename ?? 'audio.webm', {
      language: b.language || undefined,
    }),
  );
  ok(res, result, 'Audio transcribed.');
};
