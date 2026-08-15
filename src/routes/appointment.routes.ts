import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  bookRecurring,
  cancelAppointment,
  checkInAppointment,
  checkOutAppointment,
  createAppointment,
  getAppointment,
  getCalendar,
  getQueue,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
  walkInAppointment,
} from '../controllers/appointment.controller.js';

export const appointmentRouter = Router();
appointmentRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const iso = z.string().datetime({ offset: true });
const aId = z.object({ appointmentId: z.string().uuid() });
const staffManage = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE');

// POST / – book appointment
appointmentRouter.post(
  '/',
  staffManage,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        doctorId: z.string().uuid(),
        departmentId: z.string().uuid().optional(),
        scheduledAt: iso,
        durationMinutes: z.number().int().min(5).max(480).default(30),
        reason: z.string().max(500).optional(),
      }),
    })
  ),
  createAppointment
);

// GET / – list appointments
appointmentRouter.get(
  '/',
  staffAll,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        from: iso.optional(),
        to: iso.optional(),
        doctorId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        status: z
          .enum(['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
          .optional(),
        departmentId: z.string().uuid().optional(),
      }),
    })
  ),
  listAppointments
);

// GET /queue – today's queue
appointmentRouter.get(
  '/queue',
  staffAll,
  validate(envelope.extend({ query: z.object({ date: z.string().date().optional() }) })),
  getQueue
);

// POST /walk-in
appointmentRouter.post(
  '/walk-in',
  staffManage,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        doctorId: z.string().uuid(),
        departmentId: z.string().uuid().optional(),
        reason: z.string().max(500).optional(),
      }),
    })
  ),
  walkInAppointment
);

// POST /recurring
appointmentRouter.post(
  '/recurring',
  staffManage,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        doctorId: z.string().uuid(),
        departmentId: z.string().uuid().optional(),
        durationMinutes: z.number().int().min(5).max(480).default(30),
        reason: z.string().max(500).optional(),
        dates: z
          .array(iso)
          .min(2)
          .max(52)
          .refine((d) => new Set(d).size === d.length, 'Dates must be unique'),
      }),
    })
  ),
  bookRecurring
);

appointmentRouter.get('/calendar', staffAll, validate(envelope.extend({ query: z.object({ from: iso, to: iso, doctorId: z.string().uuid().optional(), patientId: z.string().uuid().optional(), status: z.enum(['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional() }) })), getCalendar);

// GET /:appointmentId
appointmentRouter.get(
  '/:appointmentId',
  staffAll,
  validate(envelope.extend({ params: aId })),
  getAppointment
);

// PATCH /:appointmentId/status
appointmentRouter.patch(
  '/:appointmentId/status',
  staffManage,
  validate(
    envelope.extend({
      params: aId,
      body: z.object({
        status: z.enum(['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
        notes: z.string().max(1000).optional(),
      }),
    })
  ),
  updateAppointmentStatus
);

// POST /:appointmentId/reschedule
appointmentRouter.post(
  '/:appointmentId/reschedule',
  staffManage,
  validate(
    envelope.extend({
      params: aId,
      body: z.object({
        scheduledAt: iso,
        durationMinutes: z.number().int().min(5).max(480).optional(),
      }),
    })
  ),
  rescheduleAppointment
);

// POST /:appointmentId/cancel
appointmentRouter.post(
  '/:appointmentId/cancel',
  staffManage,
  validate(
    envelope.extend({
      params: aId,
      body: z.object({ reason: z.string().max(500).optional() }),
    })
  ),
  cancelAppointment
);

// POST /:appointmentId/check-in
appointmentRouter.post(
  '/:appointmentId/check-in',
  staffManage,
  validate(envelope.extend({ params: aId })),
  checkInAppointment
);

// POST /:appointmentId/check-out
appointmentRouter.post(
  '/:appointmentId/check-out',
  staffManage,
  validate(envelope.extend({ params: aId })),
  checkOutAppointment
);
