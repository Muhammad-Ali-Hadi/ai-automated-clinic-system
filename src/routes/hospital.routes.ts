import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createBranch,
  deleteBranch,
  getHospital,
  listBranches,
  replaceWorkingHours,
  updateBranch,
  updateHospital,
  updateSettings,
} from '../controllers/hospital.controller.js';

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM time');

export const hospitalRouter = Router();
hospitalRouter.use(authenticate, requireTenant);

hospitalRouter.get('/me', authorize('HOSPITAL_ADMIN'), getHospital);

hospitalRouter.patch(
  '/me',
  authorize('HOSPITAL_ADMIN'),
  validate(
    envelope.extend({
      body: z
        .object({ name: z.string().min(2).max(200).optional(), isActive: z.boolean().optional() })
        .refine((v) => Object.keys(v).length > 0, 'At least one field required'),
    })
  ),
  updateHospital
);

hospitalRouter.put(
  '/me/settings',
  authorize('HOSPITAL_ADMIN'),
  validate(
    envelope.extend({
      body: z.object({
        preferences: z.record(z.unknown()).optional(),
        configuration: z.record(z.unknown()).optional(),
        subscriptionPlan: z.string().min(1).max(100).optional(),
        subscriptionEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
        logoKey: z.string().min(1).max(500).nullable().optional(),
      }),
    })
  ),
  updateSettings
);

hospitalRouter.post(
  '/branches',
  authorize('HOSPITAL_ADMIN'),
  validate(
    envelope.extend({
      body: z.object({
        name: z.string().min(2).max(120),
        address: z.string().max(500).optional(),
        phone: z.string().max(30).optional(),
      }),
    })
  ),
  createBranch
);

hospitalRouter.get(
  '/branches',
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'),
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().max(100).optional(),
      }),
    })
  ),
  listBranches
);

hospitalRouter.patch(
  '/branches/:branchId',
  authorize('HOSPITAL_ADMIN'),
  validate(
    envelope.extend({
      params: z.object({ branchId: z.string().uuid() }),
      body: z
        .object({
          name: z.string().min(2).max(120).optional(),
          address: z.string().max(500).optional(),
          phone: z.string().max(30).optional(),
          isActive: z.boolean().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field required'),
    })
  ),
  updateBranch
);

hospitalRouter.delete(
  '/branches/:branchId',
  authorize('HOSPITAL_ADMIN'),
  validate(envelope.extend({ params: z.object({ branchId: z.string().uuid() }) })),
  deleteBranch
);

hospitalRouter.put(
  '/branches/:branchId/working-hours',
  authorize('HOSPITAL_ADMIN'),
  validate(
    envelope.extend({
      params: z.object({ branchId: z.string().uuid() }),
      body: z.object({
        hours: z
          .array(
            z
              .object({
                weekday: z.number().int().min(0).max(6),
                opensAt: time,
                closesAt: time,
                isClosed: z.boolean().optional(),
              })
              .refine((v) => v.isClosed || v.opensAt < v.closesAt, 'opensAt must be before closesAt')
          )
          .min(1)
          .max(7)
          .refine(
            (v) => new Set(v.map((h) => h.weekday)).size === v.length,
            'Weekdays must be unique'
          ),
      }),
    })
  ),
  replaceWorkingHours
);
