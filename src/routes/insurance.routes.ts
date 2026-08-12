import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  submitClaim,
  listClaims,
  getClaim,
  approveClaim,
  rejectClaim,
} from '../controllers/insurance.controller.js';

export const insuranceRouter = Router();
insuranceRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const adminOnly = authorize('HOSPITAL_ADMIN');
const claimRead = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST');

insuranceRouter.post(
  '/',
  adminOnly,
  validate(envelope.extend({
    body: z.object({
      patientId: z.string().uuid(),
      invoiceId: z.string().uuid().optional(),
      providerName: z.string().min(1).max(200),
      amount: z.number().positive(),
    }),
  })),
  submitClaim
);

insuranceRouter.get(
  '/',
  claimRead,
  validate(envelope.extend({
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      patientId: z.string().uuid().optional(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']).optional(),
      providerName: z.string().optional(),
    }),
  })),
  listClaims
);

insuranceRouter.get(
  '/:id',
  claimRead,
  validate(envelope.extend({ params: z.object({ id: z.string().uuid() }) })),
  getClaim
);

insuranceRouter.post(
  '/:id/approve',
  adminOnly,
  validate(envelope.extend({ params: z.object({ id: z.string().uuid() }) })),
  approveClaim
);

insuranceRouter.post(
  '/:id/reject',
  adminOnly,
  validate(envelope.extend({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ reason: z.string().min(1) }),
  })),
  rejectClaim
);
