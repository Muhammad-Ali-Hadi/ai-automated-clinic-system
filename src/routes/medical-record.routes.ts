import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createMedicalRecord,
  getMedicalRecord,
  listMedicalRecords,
  updateMedicalRecord,
} from '../controllers/medical-record.controller.js';

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });

export const medicalRecordRouter = Router();
medicalRecordRouter.use(authenticate, requireTenant);

const clinicalWrite = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');

// POST / – create medical record
medicalRecordRouter.post(
  '/',
  clinicalWrite,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        recordType: z.string().min(2).max(80),
        title: z.string().min(2).max(200),
        content: z.string().min(1).max(10000),
      }),
    })
  ),
  createMedicalRecord
);

// GET /patient/:patientId – list records for a patient
medicalRecordRouter.get(
  '/patient/:patientId',
  staffAll,
  validate(
    envelope.extend({
      params: z.object({ patientId: z.string().uuid() }),
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        recordType: z.string().optional(),
      }),
    })
  ),
  listMedicalRecords
);

// GET /:recordId – get a medical record
medicalRecordRouter.get(
  '/:recordId',
  staffAll,
  validate(
    envelope.extend({
      params: z.object({ recordId: z.string().uuid() }),
    })
  ),
  getMedicalRecord
);

// PATCH /:recordId – update a medical record
medicalRecordRouter.patch(
  '/:recordId',
  clinicalWrite,
  validate(
    envelope.extend({
      params: z.object({ recordId: z.string().uuid() }),
      body: z
        .object({
          title: z.string().min(2).max(200).optional(),
          content: z.string().min(1).max(10000).optional(),
          recordType: z.string().min(2).max(80).optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field to update'),
    })
  ),
  updateMedicalRecord
);
