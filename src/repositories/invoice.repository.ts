import { prisma } from '../lib/prisma.js';
import type { PaymentStatus } from '@prisma/client';

export const invoiceRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    invoiceNumber: string;
    subtotal: number;
    discount?: number;
    total: number;
    dueAt?: Date;
  }) =>
    prisma.invoice.create({
      data: {
        ...data,
        subtotal: data.subtotal as never,
        discount: data.discount !== undefined ? (data.discount as never) : undefined,
        total: data.total as never,
      },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.invoice.findFirst({
      where: { id, hospitalId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
      },
    }),

  findByInvoiceNumber: (hospitalId: string, invoiceNumber: string) =>
    prisma.invoice.findFirst({ where: { invoiceNumber, hospitalId } }),

  updateStatus: (
    hospitalId: string,
    id: string,
    status: PaymentStatus,
    extra: { paidAt?: Date | null } = {}
  ) =>
    prisma.invoice.updateMany({
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
      status?: PaymentStatus;
      search?: string;
    } = {}
  ) =>
    prisma.invoice.findMany({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { invoiceNumber: { contains: filters.search, mode: 'insensitive' } } : {}),
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
      status?: PaymentStatus;
      search?: string;
    } = {}
  ) =>
    prisma.invoice.count({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { invoiceNumber: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
    }),
};
