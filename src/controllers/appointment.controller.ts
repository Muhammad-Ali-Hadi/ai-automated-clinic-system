import type { RequestHandler } from 'express';
import { appointmentService } from '../services/appointment.service.js';
import { ok } from '../utils/api-response.js';
import type { AppointmentStatus } from '@prisma/client';

export const createAppointment: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.create(req.auth!, req.body), 'Appointment booked.', 201);

export const listAppointments: RequestHandler = async (req, res) => {
  const result = await appointmentService.list(req.auth!, req.query as never);
  ok(res, result.data, 'Appointments retrieved.', 200, result.meta);
};

export const getCalendar: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.calendar(req.auth!, req.query as any), 'Calendar retrieved.');

export const getAppointment: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.get(req.auth!, String(req.params.appointmentId)), 'Appointment retrieved.');

export const updateAppointmentStatus: RequestHandler = async (req, res) =>
  ok(
    res,
    await appointmentService.updateStatus(
      req.auth!,
      String(req.params.appointmentId),
      req.body.status as AppointmentStatus,
      req.body.notes
    ),
    'Appointment status updated.'
  );

export const rescheduleAppointment: RequestHandler = async (req, res) =>
  ok(
    res,
    await appointmentService.reschedule(req.auth!, String(req.params.appointmentId), req.body),
    'Appointment rescheduled.'
  );

export const cancelAppointment: RequestHandler = async (req, res) => {
  await appointmentService.cancel(req.auth!, String(req.params.appointmentId), req.body.reason);
  ok(res, null, 'Appointment cancelled.');
};

export const checkInAppointment: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.checkIn(req.auth!, String(req.params.appointmentId)), 'Checked in.');

export const checkOutAppointment: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.checkOut(req.auth!, String(req.params.appointmentId)), 'Checked out.');

export const walkInAppointment: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.walkIn(req.auth!, req.body), 'Walk-in registered.', 201);

export const getQueue: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.getQueue(req.auth!, req.query.date as string | undefined), 'Queue retrieved.');

export const bookRecurring: RequestHandler = async (req, res) =>
  ok(res, await appointmentService.bookRecurring(req.auth!, req.body), 'Recurring appointments booked.', 201);
