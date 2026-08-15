import { prisma } from '../lib/prisma.js';
import type { AppointmentStatus } from '@prisma/client';

export const appointmentRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    doctorId: string;
    departmentId?: string;
    scheduledAt: Date;
    durationMinutes?: number;
    reason?: string;
    notes?: string;
  }) => prisma.appointment.create({ data }),

  findById: (hospitalId: string, id: string) =>
    prisma.appointment.findFirst({
      where: { id, hospitalId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        department: { select: { id: true, name: true } },
        queueEntry: true,
        consultation: true,
      },
    }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    filters: {
      from?: Date;
      to?: Date;
      doctorId?: string;
      patientId?: string;
      status?: AppointmentStatus;
      departmentId?: string;
    } = {}
  ) =>
    prisma.appointment.findMany({
      where: {
        hospitalId,
        ...(filters.from || filters.to
          ? {
              scheduledAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      skip,
      take,
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        department: { select: { id: true, name: true } },
        queueEntry: true,
      },
    }),

  count: (
    hospitalId: string,
    filters: {
      from?: Date;
      to?: Date;
      doctorId?: string;
      patientId?: string;
      status?: AppointmentStatus;
      departmentId?: string;
    } = {}
  ) =>
    prisma.appointment.count({
      where: {
        hospitalId,
        ...(filters.from || filters.to
          ? {
              scheduledAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
    }),

  updateStatus: (hospitalId: string, id: string, status: AppointmentStatus, notes?: string) =>
    prisma.appointment.updateMany({
      where: { id, hospitalId },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    }),

  reschedule: (hospitalId: string, id: string, scheduledAt: Date, durationMinutes?: number) =>
    prisma.appointment.updateMany({
      where: { id, hospitalId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        scheduledAt,
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
        status: 'BOOKED',
      },
    }),

  cancel: (hospitalId: string, id: string, reason?: string) =>
    prisma.appointment.updateMany({
      where: { id, hospitalId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        status: 'CANCELLED',
        ...(reason !== undefined ? { notes: reason } : {}),
      },
    }),

  // Conflict detection: check if doctor has overlapping appointment
  hasConflict: async (
    hospitalId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeId?: string
  ) => {
    const start = scheduledAt;
    const end = new Date(scheduledAt.getTime() + durationMinutes * 60000);
    const count = await prisma.appointment.count({
      where: {
        hospitalId,
        doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [{ scheduledAt: { lt: end } }, {
          // scheduledAt + durationMinutes > start
          // We need scheduledAt + durationMinutes*60000 > start
          // Prisma raw: can't do computed, so we approximate using raw date range
          scheduledAt: { gte: new Date(start.getTime() - 8 * 60 * 60000) }, // max 8h appointments
        }],
      },
    });
    if (count === 0) return false;
    // More precise check with raw query approach: get all overlapping candidates
    const candidates = await prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        scheduledAt: {
          gte: new Date(start.getTime() - 8 * 60 * 60000),
          lt: end,
        },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
    return candidates.some((a) => {
      const aEnd = new Date(a.scheduledAt.getTime() + a.durationMinutes * 60000);
      return a.scheduledAt < end && aEnd > start;
    });
  },

  // Check-in: update to CHECKED_IN + create/update QueueEntry
  checkIn: (hospitalId: string, appointmentId: string) =>
    prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: { id: appointmentId, hospitalId },
        include: { queueEntry: true },
      });
      if (!appt) throw new Error('Appointment not found.');
      if (!['BOOKED', 'CHECKED_IN'].includes(appt.status))
        throw new Error(`Cannot check in appointment with status: ${appt.status}`);

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CHECKED_IN' },
      });

      if (!appt.queueEntry) {
        // Assign next queue number for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastEntry = await tx.queueEntry.findFirst({
          where: { hospitalId, createdAt: { gte: today } },
          orderBy: { queueNumber: 'desc' },
        });
        const nextNum = (lastEntry?.queueNumber ?? 0) + 1;
        await tx.queueEntry.create({
          data: {
            hospitalId,
            appointmentId,
            queueNumber: nextNum,
            status: 'WAITING',
            checkedInAt: new Date(),
          },
        });
      } else {
        await tx.queueEntry.update({
          where: { id: appt.queueEntry.id },
          data: { status: 'WAITING', checkedInAt: new Date() },
        });
      }
      return tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { queueEntry: true },
      });
    }),

  // Check-out
  checkOut: (hospitalId: string, appointmentId: string) =>
    prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: { id: appointmentId, hospitalId },
        include: { queueEntry: true },
      });
      if (!appt) throw new Error('Appointment not found.');
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });
      if (appt.queueEntry) {
        await tx.queueEntry.update({
          where: { id: appt.queueEntry.id },
          data: { status: 'DONE', checkedOutAt: new Date() },
        });
      }
      return tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { queueEntry: true },
      });
    }),

  // Walk-in: create appointment + immediately check-in
  walkIn: (data: {
    hospitalId: string;
    patientId: string;
    doctorId: string;
    departmentId?: string;
    reason?: string;
  }) =>
    prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          hospitalId: data.hospitalId,
          patientId: data.patientId,
          doctorId: data.doctorId,
          departmentId: data.departmentId,
          scheduledAt: new Date(),
          durationMinutes: 30,
          reason: data.reason,
          status: 'CHECKED_IN',
        },
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastEntry = await tx.queueEntry.findFirst({
        where: { hospitalId: data.hospitalId, createdAt: { gte: today } },
        orderBy: { queueNumber: 'desc' },
      });
      const nextNum = (lastEntry?.queueNumber ?? 0) + 1;
      const queue = await tx.queueEntry.create({
        data: {
          hospitalId: data.hospitalId,
          appointmentId: appt.id,
          queueNumber: nextNum,
          status: 'WAITING',
          checkedInAt: new Date(),
        },
      });
      return { ...appt, queueEntry: queue };
    }),

  // Queue
  getQueue: (hospitalId: string, date?: Date) => {
    const day = date ?? new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return prisma.queueEntry.findMany({
      where: {
        hospitalId,
        createdAt: { gte: start, lte: end },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      orderBy: { queueNumber: 'asc' },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
            doctor: {
              select: {
                id: true,
                specialization: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
  },

  // Recurring: create multiple appointments from a pattern
  createRecurring: (
    base: {
      hospitalId: string;
      patientId: string;
      doctorId: string;
      departmentId?: string;
      durationMinutes?: number;
      reason?: string;
    },
    dates: Date[]
  ) =>
    prisma.appointment.createMany({
      data: dates.map((scheduledAt) => ({
        ...base,
        scheduledAt,
        durationMinutes: base.durationMinutes ?? 30,
      })),
      skipDuplicates: true,
    }),
};
