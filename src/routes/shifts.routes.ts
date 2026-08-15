import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createShift, listShifts, getShift, updateShift, assignShift, removeShiftAssignment } from '../controllers/shift.controller.js';

export const shiftRouter = Router();
shiftRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const adminOnly = authorize('HOSPITAL_ADMIN');

shiftRouter.post(
  '/',
  adminOnly,
  validate(envelope.extend({
    body: z.object({
      name: z.string().min(1).max(100),
      startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
      endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
      description: z.string().max(500).optional(),
    }),
  })),
  createShift
);

shiftRouter.get('/', adminOnly, listShifts);

shiftRouter.get(
  '/:id',
  adminOnly,
  validate(envelope.extend({ params: z.object({ id: z.string().uuid() }) })),
  getShift
);

shiftRouter.put(
  '/:id',
  adminOnly,
  validate(envelope.extend({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      description: z.string().max(500).optional(),
      isActive: z.boolean().optional(),
    }),
  })),
  updateShift
);

shiftRouter.post(
  '/:id/assign',
  adminOnly,
  validate(envelope.extend({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ userId: z.string().uuid() }),
  })),
  assignShift
);

shiftRouter.delete(
  '/:id/assign/:userId',
  adminOnly,
  validate(envelope.extend({
    params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
  })),
  removeShiftAssignment
);
