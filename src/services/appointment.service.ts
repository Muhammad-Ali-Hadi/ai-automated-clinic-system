import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { appointmentRepository } from '../repositories/appointment.repository.js';
import type { AppointmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

// Validate status transitions
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// Doctor availability enforcement
const checkDoctorAvailability = async (
  hospitalId: string,
  doctorId: string,
  scheduledAt: Date,
  durationMinutes: number
) => {
  const availabilities = await prisma.doctorAvailability.findMany({
    where: { hospitalId, doctorId }
  });
  if (availabilities.length > 0) {
    const dayOfWeek = scheduledAt.getUTCDay();
    // Find matching slots for this day of week where isAvailable is true
    const daySlots = availabilities.filter(
      (a) => a.weekday === dayOfWeek && a.isAvailable === true
    );
    if (daySlots.length === 0) {
      throw new AppError('Doctor is not available on this day of the week.', 409);
    }

    const apptStartMinutes = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
    const apptEndMinutes = apptStartMinutes + durationMinutes;

    const hasMatchingSlot = daySlots.some((slot) => {
      const startParts = slot.startsAt.split(':');
      const endParts = slot.endsAt.split(':');
      const startH = Number(startParts[0] ?? 0);
      const startM = Number(startParts[1] ?? 0);
      const endH = Number(endParts[0] ?? 0);
      const endM = Number(endParts[1] ?? 0);
      const slotStartMinutes = startH * 60 + startM;
      const slotEndMinutes = endH * 60 + endM;
      return slotStartMinutes <= apptStartMinutes && apptEndMinutes <= slotEndMinutes;
    });

    if (!hasMatchingSlot) {
      throw new AppError("Appointment time is outside the doctor's available hours.", 409);
    }
  }
};

export const appointmentService = {
  async create(
    auth: TenantAuth,
    input: {
      patientId: string;
      doctorId: string;
      departmentId?: string;
      scheduledAt: string;
      durationMinutes?: number;
      reason?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const scheduledAt = new Date(input.scheduledAt);
    const duration = input.durationMinutes ?? 30;

    // Check availability
    await checkDoctorAvailability(hospitalId, input.doctorId, scheduledAt, duration);

    // Conflict check
    const conflict = await appointmentRepository.hasConflict(
      hospitalId,
      input.doctorId,
      scheduledAt,
      duration
    );
    if (conflict) throw new AppError('Doctor already has an appointment at this time.', 409);

    const appointment = await appointmentRepository.create({
      ...input,
      hospitalId,
      scheduledAt,
      durationMinutes: duration,
    });
    await auditService.record(auth, 'CREATE', 'Appointment', appointment.id);
    return appointment;
  },

  async calendar(auth: TenantAuth, query: { from: string; to: string; doctorId?: string; patientId?: string; status?: AppointmentStatus }) {
    const result = await this.list(auth, { ...query, page: 1, limit: 100 });
    const grouped: Record<string, typeof result.data> = {};
    for (const appointment of result.data) {
      const key = appointment.scheduledAt.toISOString().slice(0, 10);
      (grouped[key] ??= []).push(appointment);
    }
    return Object.entries(grouped).map(([date, appointments]) => ({ date, appointments }));
  },

  async get(auth: TenantAuth, appointmentId: string) {
    const appt = await appointmentRepository.findById(hid(auth), appointmentId);
    if (!appt) throw new AppError('Appointment not found.', 404);
    return appt;
  },

  async list(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      doctorId?: string;
      patientId?: string;
      status?: AppointmentStatus;
      departmentId?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      doctorId: query.doctorId,
      patientId: query.patientId,
      status: query.status,
      departmentId: query.departmentId,
    };
    const [data, total] = await Promise.all([
      appointmentRepository.list(hospitalId, (page - 1) * limit, limit, filters),
      appointmentRepository.count(hospitalId, filters),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateStatus(
    auth: TenantAuth,
    appointmentId: string,
    status: AppointmentStatus,
    notes?: string
  ) {
    const appt = await this.get(auth, appointmentId);
    const allowed = VALID_TRANSITIONS[appt.status];
    if (!allowed.includes(status))
      throw new AppError(
        `Cannot transition from ${appt.status} to ${status}.`,
        400
      );
    const result = await appointmentRepository.updateStatus(hid(auth), appointmentId, status, notes);
    if (!result.count) throw new AppError('Appointment not found.', 404);
    await auditService.record(auth, 'UPDATE_STATUS', 'Appointment', appointmentId, {
      from: appt.status,
      to: status,
    });
    return this.get(auth, appointmentId);
  },

  async reschedule(
    auth: TenantAuth,
    appointmentId: string,
    input: { scheduledAt: string; durationMinutes?: number }
  ) {
    const appt = await this.get(auth, appointmentId);
    if (['COMPLETED', 'CANCELLED'].includes(appt.status))
      throw new AppError(`Cannot reschedule a ${appt.status} appointment.`, 400);

    const scheduledAt = new Date(input.scheduledAt);
    const duration = input.durationMinutes ?? appt.durationMinutes;

    // Check availability
    await checkDoctorAvailability(hid(auth), appt.doctorId, scheduledAt, duration);

    const conflict = await appointmentRepository.hasConflict(
      hid(auth),
      appt.doctorId,
      scheduledAt,
      duration,
      appointmentId
    );
    if (conflict) throw new AppError('Doctor already has an appointment at this time.', 409);

    const result = await appointmentRepository.reschedule(
      hid(auth),
      appointmentId,
      scheduledAt,
      input.durationMinutes
    );
    if (!result.count) throw new AppError('Appointment not found or cannot be rescheduled.', 400);
    await auditService.record(auth, 'RESCHEDULE', 'Appointment', appointmentId, {
      scheduledAt: input.scheduledAt,
    });
    return this.get(auth, appointmentId);
  },

  async cancel(auth: TenantAuth, appointmentId: string, reason?: string) {
    const appt = await this.get(auth, appointmentId);
    if (['COMPLETED', 'CANCELLED'].includes(appt.status))
      throw new AppError(`Cannot cancel a ${appt.status} appointment.`, 400);
    const result = await appointmentRepository.cancel(hid(auth), appointmentId, reason);
    if (!result.count) throw new AppError('Appointment not found.', 404);
    await auditService.record(auth, 'CANCEL', 'Appointment', appointmentId, { reason });
  },

  async checkIn(auth: TenantAuth, appointmentId: string) {
    await this.get(auth, appointmentId); // tenant isolation check
    const appt = await appointmentRepository.checkIn(hid(auth), appointmentId);
    await auditService.record(auth, 'CHECK_IN', 'Appointment', appointmentId);
    return appt;
  },

  async checkOut(auth: TenantAuth, appointmentId: string) {
    await this.get(auth, appointmentId); // tenant isolation check
    const appt = await appointmentRepository.checkOut(hid(auth), appointmentId);
    await auditService.record(auth, 'CHECK_OUT', 'Appointment', appointmentId);
    return appt;
  },

  async walkIn(
    auth: TenantAuth,
    input: {
      patientId: string;
      doctorId: string;
      departmentId?: string;
      reason?: string;
    }
  ) {
    const appt = await appointmentRepository.walkIn({ hospitalId: hid(auth), ...input });
    await auditService.record(auth, 'WALK_IN', 'Appointment', appt.id);
    return appt;
  },

  async getQueue(auth: TenantAuth, date?: string) {
    return appointmentRepository.getQueue(
      hid(auth),
      date ? new Date(date) : undefined
    );
  },

  async bookRecurring(
    auth: TenantAuth,
    input: {
      patientId: string;
      doctorId: string;
      departmentId?: string;
      durationMinutes?: number;
      reason?: string;
      dates: string[];
    }
  ) {
    const hospitalId = hid(auth);
    const dates = input.dates.map((d) => new Date(d));
    const duration = input.durationMinutes ?? 30;

    // Check availability and conflicts for all dates
    for (const date of dates) {
      await checkDoctorAvailability(hospitalId, input.doctorId, date, duration);

      const conflict = await appointmentRepository.hasConflict(
        hospitalId,
        input.doctorId,
        date,
        duration
      );
      if (conflict)
        throw new AppError(
          `Doctor already has an appointment at ${date.toISOString()}.`,
          409
        );
    }

    const result = await appointmentRepository.createRecurring(
      { hospitalId, ...input },
      dates
    );
    await auditService.record(auth, 'CREATE_RECURRING', 'Appointment', undefined, {
      count: result.count,
      patientId: input.patientId,
    });
    return result;
  },
};
