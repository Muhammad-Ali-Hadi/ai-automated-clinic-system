import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  aiStatus,
  aiChat,
  aiReceptionist,
  aiDischargeSummary,
  aiLabInterpretation,
  aiPrescriptionDraft,
  aiLabAnalysis,
  aiPatientExplainer,
  aiBilling,
  aiPharmacy,
  aiDocument,
  aiSmartSearch,
  aiAnalytics,
  aiKnowledgeQuery,
  aiKnowledgeIngest,
  aiTranscribe,
} from '../controllers/ai.controller.js';

export const aiRouter = Router();
aiRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const str = (max = 20_000) => z.string().min(1).max(max);

const anyStaff = authorize(
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'PHARMACIST',
  'LABORATORY_TECHNICIAN',
  'ACCOUNTANT',
);
const clinical = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');
const adminOrDoctor = authorize('HOSPITAL_ADMIN', 'DOCTOR');

aiRouter.get('/status', anyStaff, aiStatus);

// ── Conversational ────────────────────────────────────────────────────────────
aiRouter.post(
  '/chat',
  anyStaff,
  validate(
    envelope.extend({
      body: z.object({
        message: str(8_000),
        sessionId: z.string().min(1).max(200).optional(),
        patientId: z.string().uuid().optional(),
        hospitalName: z.string().max(200).optional(),
        department: z.string().max(120).optional(),
        clinicianRole: z.string().max(60).optional(),
      }),
    }),
  ),
  aiChat,
);

aiRouter.post(
  '/receptionist',
  anyStaff,
  validate(
    envelope.extend({
      body: z.object({
        patientQuery: str(4_000),
        sessionId: z.string().min(1).max(200).optional(),
        doctorSchedules: z.string().max(8_000).optional(),
        hospitalFaqs: z.string().max(8_000).optional(),
        patientLanguage: z.string().max(60).optional(),
        hospitalName: z.string().max(200).optional(),
      }),
    }),
  ),
  aiReceptionist,
);

// ── Doctor assistant ──────────────────────────────────────────────────────────
aiRouter.post(
  '/discharge-summary',
  clinical,
  validate(
    envelope.extend({
      body: z.object({
        patientAge: str(10),
        patientGender: str(20),
        admissionDate: str(40),
        dischargeDate: str(40),
        clinicalNotes: str(10_000),
        medications: z.string().max(5_000).optional(),
        procedures: z.string().max(5_000).optional(),
      }),
    }),
  ),
  aiDischargeSummary,
);

aiRouter.post(
  '/lab-interpretation',
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LABORATORY_TECHNICIAN'),
  validate(
    envelope.extend({
      body: z.object({ labResults: str(10_000), patientContext: z.string().max(4_000).optional() }),
    }),
  ),
  aiLabInterpretation,
);

aiRouter.post(
  '/lab-analysis',
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LABORATORY_TECHNICIAN'),
  validate(
    envelope.extend({
      body: z.object({
        currentReport: str(10_000),
        patientAgeGender: z.string().max(60).optional(),
        historicalReports: z.string().max(10_000).optional(),
      }),
    }),
  ),
  aiLabAnalysis,
);

aiRouter.post(
  '/prescription-draft',
  clinical,
  validate(
    envelope.extend({
      body: z.object({
        diagnosis: str(2_000),
        patientAge: str(10),
        patientGender: str(20),
        allergies: z.string().max(2_000).optional(),
        currentMedications: z.string().max(2_000).optional(),
        weightKg: z.string().max(10).optional(),
      }),
    }),
  ),
  aiPrescriptionDraft,
);

// ── Patient assistant ─────────────────────────────────────────────────────────
aiRouter.post(
  '/patient-explainer',
  anyStaff,
  validate(
    envelope.extend({
      body: z.object({
        patientQuery: str(4_000),
        medicalData: z.string().max(10_000).optional(),
        targetLanguage: z.string().max(60).optional(),
      }),
    }),
  ),
  aiPatientExplainer,
);

// ── Operations ────────────────────────────────────────────────────────────────
aiRouter.post(
  '/billing',
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'),
  validate(
    envelope.extend({
      body: z.object({
        action: z.string().max(60).optional(),
        invoiceData: str(10_000),
        paymentHistory: z.string().max(10_000).optional(),
      }),
    }),
  ),
  aiBilling,
);

aiRouter.post(
  '/pharmacy',
  authorize('HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE'),
  validate(
    envelope.extend({
      body: z.object({
        action: z.string().max(60).optional(),
        medicationsList: str(10_000),
        currentInventory: z.string().max(10_000).optional(),
      }),
    }),
  ),
  aiPharmacy,
);

aiRouter.post(
  '/document',
  anyStaff,
  validate(
    envelope.extend({
      body: z.object({ documentText: str(20_000), documentType: z.string().max(60).optional() }),
    }),
  ),
  aiDocument,
);

aiRouter.post(
  '/smart-search',
  anyStaff,
  validate(envelope.extend({ body: z.object({ naturalLanguageQuery: str(1_000) }) })),
  aiSmartSearch,
);

aiRouter.post(
  '/analytics',
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  validate(
    envelope.extend({
      body: z.object({ analysisPeriod: z.string().max(120).optional(), metricsData: str(20_000) }),
    }),
  ),
  aiAnalytics,
);

// ── Knowledge base (RAG) ──────────────────────────────────────────────────────
aiRouter.post(
  '/knowledge/query',
  anyStaff,
  validate(
    envelope.extend({
      body: z.object({ question: str(2_000), collectionName: z.string().max(120).optional() }),
    }),
  ),
  aiKnowledgeQuery,
);

aiRouter.post(
  '/knowledge/ingest',
  adminOrDoctor,
  validate(
    envelope.extend({
      body: z.object({
        content: str(100_000),
        title: z.string().max(200).optional(),
        category: z.enum(['policy', 'guideline', 'sop', 'handbook', 'faq']).optional(),
      }),
    }),
  ),
  aiKnowledgeIngest,
);

// ── Voice ─────────────────────────────────────────────────────────────────────
aiRouter.post(
  '/transcribe',
  anyStaff,
  validate(
    envelope.extend({
      body: z.object({
        audioBase64: z.string().min(16),
        filename: z.string().max(200).optional(),
        language: z.string().max(10).optional(),
      }),
    }),
  ),
  aiTranscribe,
);
