import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createDoctorProfile,
  getAvailability,
  getDoctorProfile,
  listDoctorConsultations,
  listDoctors,
  setAvailability,
  updateDoctorProfile,
} from '../controllers/doctor.controller.js';

export const doctorRouter = Router();
doctorRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const dId = z.object({ doctorId: z.string().uuid() });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM time');
const adminOnly = authorize('HOSPITAL_ADMIN');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE');

// POST / – create doctor profile
doctorRouter.post(
  '/',
  adminOnly,
  validate(
    envelope.extend({
      body: z.object({
        userId: z.string().uuid(),
        specialization: z.string().min(2).max(200),
        licenseNumber: z.string().min(2).max(100),
        consultationFee: z.number().positive().optional(),
        signatureUrl: z.string().url().max(500).optional(),
      }),
    })
  ),
  createDoctorProfile
);

// GET / – list doctors
doctorRouter.get(
  '/',
  staffAll,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().max(100).optional(),
        specialization: z.string().max(200).optional(),
      }),
    })
  ),
  listDoctors
);

// GET /:doctorId
doctorRouter.get(
  '/:doctorId',
  staffAll,
  validate(envelope.extend({ params: dId })),
  getDoctorProfile
);

// PATCH /:doctorId
doctorRouter.patch(
  '/:doctorId',
  adminOnly,
  validate(
    envelope.extend({
      params: dId,
      body: z
        .object({
          specialization: z.string().min(2).max(200).optional(),
          licenseNumber: z.string().min(2).max(100).optional(),
          consultationFee: z.number().positive().nullable().optional(),
          signatureUrl: z.string().url().max(500).nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field required'),
    })
  ),
  updateDoctorProfile
);

// PUT /:doctorId/availability
doctorRouter.put(
  '/:doctorId/availability',
  adminOnly,
  validate(
    envelope.extend({
      params: dId,
      body: z.object({
        slots: z
          .array(
            z
              .object({
                weekday: z.number().int().min(0).max(6),
                startsAt: time,
                endsAt: time,
                isAvailable: z.boolean().optional(),
              })
              .refine((s) => !s.isAvailable || s.startsAt < s.endsAt, 'startsAt must be before endsAt')
          )
          .min(1)
          .max(21), // up to 3 slots per day × 7 days
      }),
    })
  ),
  setAvailability
);

// GET /:doctorId/availability
doctorRouter.get(
  '/:doctorId/availability',
  staffAll,
  validate(envelope.extend({ params: dId })),
  getAvailability
);

// GET /:doctorId/consultations
doctorRouter.get(
  '/:doctorId/consultations',
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  validate(
    envelope.extend({
      params: dId,
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
    })
  ),
  listDoctorConsultations
);
