import { prisma } from '../lib/prisma.js';

export const medicalRecordRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    recordType: string;
    title: string;
    content: string;
    recordedById: string;
  }) => prisma.medicalRecord.create({ data }),

  findById: (hospitalId: string, id: string) =>
    prisma.medicalRecord.findFirst({
      where: { id, hospitalId },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

  update: (
    hospitalId: string,
    id: string,
    data: {
      title?: string;
      content?: string;
      recordType?: string;
    }
  ) =>
    prisma.medicalRecord.updateMany({
      where: { id, hospitalId },
      data,
    }),

  list: (
    hospitalId: string,
    patientId: string,
    skip: number,
    take: number,
    recordType?: string
  ) =>
    prisma.medicalRecord.findMany({
      where: {
        hospitalId,
        patientId,
        ...(recordType ? { recordType } : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

  count: (hospitalId: string, patientId: string, recordType?: string) =>
    prisma.medicalRecord.count({
      where: {
        hospitalId,
        patientId,
        ...(recordType ? { recordType } : {}),
      },
    }),
};
