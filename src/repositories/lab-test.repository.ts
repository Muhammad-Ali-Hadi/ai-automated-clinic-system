import { prisma } from '../lib/prisma.js';
import type { LabRequestStatus } from '@prisma/client';

export const labTestRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    requestedById: string;
    testName: string;
    referenceRange?: string;
    barcode?: string;
  }) => prisma.labTest.create({ data }),

  findById: (hospitalId: string, id: string) =>
    prisma.labTest.findFirst({
      where: { id, hospitalId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

  updateStatus: (
    hospitalId: string,
    id: string,
    status: LabRequestStatus,
    extra: {
      result?: string;
      referenceRange?: string;
      collectedAt?: Date;
      approvedAt?: Date;
      barcode?: string;
      rejectionReason?: string;
      rejectedAt?: Date;
    } = {}
  ) =>
    prisma.labTest.updateMany({
      where: { id, hospitalId },
      data: {
        status,
        ...extra,
      },
    }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    filters: {
      patientId?: string;
      status?: LabRequestStatus;
      search?: string;
    } = {}
  ) =>
    prisma.labTest.findMany({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { testName: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
      },
    }),

  count: (
    hospitalId: string,
    filters: {
      patientId?: string;
      status?: LabRequestStatus;
      search?: string;
    } = {}
  ) =>
    prisma.labTest.count({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { testName: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
    }),
};
