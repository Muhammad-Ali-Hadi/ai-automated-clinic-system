import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export const doctorRepository = {
  create: (data: {
    hospitalId: string;
    userId: string;
    specialization: string;
    licenseNumber: string;
    consultationFee?: number;
    signatureUrl?: string;
  }) =>
    prisma.doctorProfile.create({
      data: {
        hospitalId: data.hospitalId,
        userId: data.userId,
        specialization: data.specialization,
        licenseNumber: data.licenseNumber,
        consultationFee: data.consultationFee as never,
        signatureUrl: data.signatureUrl,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.doctorProfile.findFirst({
      where: { id, hospitalId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        availabilities: { orderBy: { weekday: 'asc' } },
      },
    }),

  findByUserId: (hospitalId: string, userId: string) =>
    prisma.doctorProfile.findFirst({
      where: { userId, hospitalId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        availabilities: { orderBy: { weekday: 'asc' } },
      },
    }),

  update: (
    hospitalId: string,
    id: string,
    data: {
      specialization?: string;
      licenseNumber?: string;
      consultationFee?: number | null;
      signatureUrl?: string | null;
    }
  ) =>
    prisma.doctorProfile.updateMany({
      where: { id, hospitalId },
      data: {
        ...data,
        consultationFee: data.consultationFee as never,
      },
    }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    search?: string,
    specialization?: string
  ) =>
    prisma.doctorProfile.findMany({
      where: {
        hospitalId,
        ...(specialization ? { specialization: { contains: specialization, mode: 'insensitive' } } : {}),
        ...(search
          ? {
              OR: [
                { specialization: { contains: search, mode: 'insensitive' } },
                { licenseNumber: { contains: search, mode: 'insensitive' } },
                {
                  user: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    }),

  count: (hospitalId: string, search?: string, specialization?: string) =>
    prisma.doctorProfile.count({
      where: {
        hospitalId,
        ...(specialization ? { specialization: { contains: specialization, mode: 'insensitive' } } : {}),
        ...(search
          ? {
              OR: [
                { specialization: { contains: search, mode: 'insensitive' } },
                { licenseNumber: { contains: search, mode: 'insensitive' } },
                {
                  user: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
    }),

  // Availability
  setAvailability: (
    doctorId: string,
    hospitalId: string,
    slots: { weekday: number; startsAt: string; endsAt: string; isAvailable?: boolean }[]
  ) =>
    prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({ where: { doctorId } });
      await tx.doctorAvailability.createMany({
        data: slots.map((s) => ({
          hospitalId,
          doctorId,
          weekday: s.weekday,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          isAvailable: s.isAvailable ?? true,
        })),
      });
      return tx.doctorAvailability.findMany({ where: { doctorId }, orderBy: { weekday: 'asc' } });
    }),

  getAvailability: (hospitalId: string, doctorId: string) =>
    prisma.doctorAvailability.findMany({
      where: { hospitalId, doctorId },
      orderBy: { weekday: 'asc' },
    }),

  // Consultations
  listConsultations: (hospitalId: string, doctorId: string, skip: number, take: number) =>
    prisma.consultation.findMany({
      where: { hospitalId, doctorId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        prescriptions: true,
      },
    }),

  countConsultations: (hospitalId: string, doctorId: string) =>
    prisma.consultation.count({ where: { hospitalId, doctorId } }),
};
