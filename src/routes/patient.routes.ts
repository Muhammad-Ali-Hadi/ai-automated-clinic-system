import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  addAllergy,
  addChronicDisease,
  addEmergencyContact,
  addInsurance,
  addPatientNote,
  addVital,
  archivePatient,
  createPatient,
  getPatient,
  listAllergies,
  listChronicDiseases,
  listEmergencyContacts,
  listInsurance,
  listPatientNotes,
  listPatients,
  listVitals,
  mergePatients,
  removeAllergy,
  removeChronicDisease,
  removeEmergencyContact,
  removeInsurance,
  updatePatient,
  getPatientTimeline,
  getPatientConsultations,
  getPatientPrescriptions,
  createDischargeSummary,
  getDischargeSummary,
} from '../controllers/patient.controller.js';

export const patientRouter = Router();
patientRouter.use(authenticate, requireTenant);

const pId = z.object({ patientId: z.string().uuid() });
const base = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const pagination = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Roles
const staffRead = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE');
const clinicalWrite = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');
const adminOnly = authorize('HOSPITAL_ADMIN');

// POST /patients – register
patientRouter.post(
  '/',
  staffRead,
  validate(
    base.extend({
      body: z.object({
        medicalRecordNumber: z.string().min(1).max(50),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        dateOfBirth: z.string().date(),
        phone: z.string().max(30).optional(),
        email: z.string().email().optional(),
      }),
    })
  ),
  createPatient
);

// GET /patients – list
patientRouter.get(
  '/',
  staffRead,
  validate(
    base.extend({
      query: z.object({
        ...pagination.shape,
        search: z.string().max(100).optional(),
        status: z.enum(['ACTIVE', 'ARCHIVED', 'MERGED', 'DECEASED']).optional(),
      }),
    })
  ),
  listPatients
);

// GET /patients/:patientId
patientRouter.get(
  '/:patientId',
  staffRead,
  validate(base.extend({ params: pId })),
  getPatient
);

// PATCH /patients/:patientId
patientRouter.patch(
  '/:patientId',
  clinicalWrite,
  validate(
    base.extend({
      params: pId,
      body: z
        .object({
          firstName: z.string().min(1).max(100).optional(),
          lastName: z.string().min(1).max(100).optional(),
          dateOfBirth: z.string().date().optional(),
          phone: z.string().max(30).nullable().optional(),
          email: z.string().email().nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field required'),
    })
  ),
  updatePatient
);

// POST /patients/:patientId/archive
patientRouter.post(
  '/:patientId/archive',
  adminOnly,
  validate(base.extend({ params: pId })),
  archivePatient
);

// POST /patients/:patientId/merge
patientRouter.post(
  '/:patientId/merge',
  adminOnly,
  validate(
    base.extend({
      params: pId,
      body: z.object({ targetPatientId: z.string().uuid() }),
    })
  ),
  mergePatients
);

// GET/POST /patients/:patientId/vitals
patientRouter.get(
  '/:patientId/vitals',
  clinicalWrite,
  validate(base.extend({ params: pId, query: pagination })),
  listVitals
);

patientRouter.post(
  '/:patientId/vitals',
  clinicalWrite,
  validate(
    base.extend({
      params: pId,
      body: z
        .object({
          temperature: z.number().min(30).max(45).optional(),
          systolicBp: z.number().int().min(50).max(250).optional(),
          diastolicBp: z.number().int().min(30).max(150).optional(),
          pulse: z.number().int().min(20).max(250).optional(),
          weightKg: z.number().min(0.5).max(500).optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one vital required'),
    })
  ),
  addVital
);

// GET/POST/DELETE /patients/:patientId/allergies
patientRouter.get(
  '/:patientId/allergies',
  staffRead,
  validate(base.extend({ params: pId })),
  listAllergies
);

patientRouter.post(
  '/:patientId/allergies',
  clinicalWrite,
  validate(
    base.extend({
      params: pId,
      body: z.object({
        substance: z.string().min(1).max(200),
        severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']).optional(),
        reaction: z.string().max(500).optional(),
      }),
    })
  ),
  addAllergy
);

patientRouter.delete(
  '/:patientId/allergies/:allergyId',
  clinicalWrite,
  validate(
    base.extend({ params: z.object({ patientId: z.string().uuid(), allergyId: z.string().uuid() }) })
  ),
  removeAllergy
);

// GET/POST/DELETE /patients/:patientId/insurance
patientRouter.get(
  '/:patientId/insurance',
  staffRead,
  validate(base.extend({ params: pId })),
  listInsurance
);

patientRouter.post(
  '/:patientId/insurance',
  staffRead,
  validate(
    base.extend({
      params: pId,
      body: z.object({
        provider: z.string().min(1).max(200),
        policyNumber: z.string().min(1).max(100),
        expiresAt: z.string().datetime({ offset: true }).optional(),
      }),
    })
  ),
  addInsurance
);

patientRouter.delete(
  '/:patientId/insurance/:insuranceId',
  adminOnly,
  validate(
    base.extend({
      params: z.object({ patientId: z.string().uuid(), insuranceId: z.string().uuid() }),
    })
  ),
  removeInsurance
);

// GET/POST/DELETE /patients/:patientId/chronic-diseases
patientRouter.get(
  '/:patientId/chronic-diseases',
  staffRead,
  validate(base.extend({ params: pId })),
  listChronicDiseases
);

patientRouter.post(
  '/:patientId/chronic-diseases',
  clinicalWrite,
  validate(
    base.extend({
      params: pId,
      body: z.object({
        name: z.string().min(1).max(200),
        diagnosedAt: z.string().date().optional(),
        notes: z.string().max(1000).optional(),
      }),
    })
  ),
  addChronicDisease
);

patientRouter.delete(
  '/:patientId/chronic-diseases/:diseaseId',
  clinicalWrite,
  validate(
    base.extend({
      params: z.object({ patientId: z.string().uuid(), diseaseId: z.string().uuid() }),
    })
  ),
  removeChronicDisease
);

// GET/POST/DELETE /patients/:patientId/emergency-contacts
patientRouter.get(
  '/:patientId/emergency-contacts',
  clinicalWrite,
  validate(base.extend({ params: pId })),
  listEmergencyContacts
);

patientRouter.post(
  '/:patientId/emergency-contacts',
  staffRead,
  validate(
    base.extend({
      params: pId,
      body: z.object({
        name: z.string().min(1).max(200),
        relationship: z.string().min(1).max(100),
        phone: z.string().min(1).max(30),
      }),
    })
  ),
  addEmergencyContact
);

patientRouter.delete(
  '/:patientId/emergency-contacts/:contactId',
  clinicalWrite,
  validate(
    base.extend({
      params: z.object({ patientId: z.string().uuid(), contactId: z.string().uuid() }),
    })
  ),
  removeEmergencyContact
);

// GET/POST /patients/:patientId/notes
patientRouter.get(
  '/:patientId/notes',
  staffRead,
  validate(base.extend({ params: pId, query: pagination })),
  listPatientNotes
);

patientRouter.post(
  '/:patientId/notes',
  clinicalWrite,
  validate(
    base.extend({
      params: pId,
      body: z.object({ content: z.string().min(1).max(5000) }),
    })
  ),
  addPatientNote
);

patientRouter.post(
  '/:patientId/discharge-summary',
  clinicalWrite,
  validate(base.extend({
    params: pId,
    body: z.object({
      diagnosis: z.string().max(2000).optional(),
      summary: z.string().min(1).max(10000),
      medications: z.string().max(5000).optional(),
      followUpInstructions: z.string().max(5000).optional(),
      dischargedAt: z.string().datetime({ offset: true }).optional(),
    }),
  })),
  createDischargeSummary
);

patientRouter.get(
  '/:patientId/discharge-summary',
  staffRead,
  validate(base.extend({ params: pId })),
  getDischargeSummary
);

// EHR Timeline and History Sub-resources
patientRouter.get(
  '/:patientId/timeline',
  staffRead,
  validate(base.extend({ params: pId })),
  getPatientTimeline
);

patientRouter.get(
  '/:patientId/consultations',
  staffRead,
  validate(base.extend({ params: pId, query: pagination })),
  getPatientConsultations
);

patientRouter.get(
  '/:patientId/prescriptions',
  staffRead,
  validate(base.extend({ params: pId, query: pagination })),
  getPatientPrescriptions
);
