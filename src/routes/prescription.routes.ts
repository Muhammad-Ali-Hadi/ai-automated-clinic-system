import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createPrescription,
  getPrescription,
  listPrescriptions,
} from '../controllers/prescription.controller.js';

export const prescriptionRouter = Router();
prescriptionRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const pId = z.object({ prescriptionId: z.string().uuid() });
const clinicalWrite = authorize('HOSPITAL_ADMIN', 'DOCTOR');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST');

// POST / – create prescription
prescriptionRouter.post(
  '/',
  clinicalWrite,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        consultationId: z.string().uuid().optional(),
        medicineName: z.string().min(1).max(200),
        dosage: z.string().min(1).max(100),
        frequency: z.string().min(1).max(100),
        durationDays: z.number().int().positive(),
        instructions: z.string().max(1000).optional(),
      }),
    })
  ),
  createPrescription
);

// GET / – list prescriptions
prescriptionRouter.get(
  '/',
  staffAll,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        patientId: z.string().uuid().optional(),
        consultationId: z.string().uuid().optional(),
      }),
    })
  ),
  listPrescriptions
);

// GET /:prescriptionId
prescriptionRouter.get(
  '/:prescriptionId',
  staffAll,
  validate(envelope.extend({ params: pId })),
  getPrescription
);
