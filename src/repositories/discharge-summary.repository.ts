import { prisma } from '../lib/prisma.js';

export const dischargeSummaryRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    dischargedById: string;
    diagnosis?: string;
    summary: string;
    medications?: string;
    followUpInstructions?: string;
    dischargedAt?: Date;
  }) => prisma.dischargeSummary.create({ data }),

  findLatest: (hospitalId: string, patientId: string) =>
    prisma.dischargeSummary.findFirst({
      where: { hospitalId, patientId },
      orderBy: { dischargedAt: 'desc' },
    }),
};
