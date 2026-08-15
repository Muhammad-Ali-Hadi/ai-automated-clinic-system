import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createConsultation,
  getConsultation,
  listConsultations,
  updateConsultation,
} from '../controllers/consultation.controller.js';

export const consultationRouter = Router();
consultationRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const cId = z.object({ consultationId: z.string().uuid() });
const clinicalWrite = authorize('HOSPITAL_ADMIN', 'DOCTOR');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');

// POST / – create consultation
consultationRouter.post(
  '/',
  clinicalWrite,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        doctorId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        clinicalNotes: z.string().min(1).max(10000),
        diagnosis: z.string().max(1000).optional(),
        treatmentPlan: z.string().max(2000).optional(),
        followUpAt: z.string().datetime({ offset: true }).optional(),
      }),
    })
  ),
  createConsultation
);

// GET / – list consultations
consultationRouter.get(
  '/',
  staffAll,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        patientId: z.string().uuid().optional(),
        doctorId: z.string().uuid().optional(),
      }),
    })
  ),
  listConsultations
);

// GET /:consultationId
consultationRouter.get(
  '/:consultationId',
  staffAll,
  validate(envelope.extend({ params: cId })),
  getConsultation
);

// PATCH /:consultationId
consultationRouter.patch(
  '/:consultationId',
  clinicalWrite,
  validate(
    envelope.extend({
      params: cId,
      body: z
        .object({
          clinicalNotes: z.string().min(1).max(10000).optional(),
          diagnosis: z.string().max(1000).optional(),
          treatmentPlan: z.string().max(2000).optional(),
          followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field to update'),
    })
  ),
  updateConsultation
);
