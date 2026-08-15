import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { invoiceRepository } from '../repositories/invoice.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { prisma } from '../lib/prisma.js';
import crypto from 'node:crypto';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const invoiceService = {
  async getSettings(hospitalId: string) {
    let settings = await prisma.hospitalSettings.findUnique({ where: { hospitalId } });
    if (!settings) {
      settings = await prisma.hospitalSettings.create({
        data: { hospitalId, preferences: {}, configuration: {} },
      });
    }
    return settings;
  },

  async generateInvoice(
    auth: TenantAuth,
    input: {
      patientId: string;
      invoiceNumber: string;
      items: { name: string; quantity: number; unitPrice: number }[];
      discount?: number;
      dueAt?: string;
    }
  ) {
    const hospitalId = hid(auth);
    // Verify patient
    const patient = await patientRepository.findById(hospitalId, input.patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    // Verify invoice number uniqueness
    const existing = await invoiceRepository.findByInvoiceNumber(hospitalId, input.invoiceNumber);
    if (existing) throw new AppError('Invoice number already exists.', 409);

    const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discount = input.discount ?? 0;
    const total = Math.max(0, subtotal - discount);

    // Create invoice + items atomically
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          hospitalId,
          patientId: input.patientId,
          invoiceNumber: input.invoiceNumber,
          subtotal,
          discount,
          total,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        },
      });

      // Create invoice items
      await tx.invoiceItem.createMany({
        data: input.items.map((item) => ({
          hospitalId,
          invoiceId: inv.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
      });

      return inv;
    });

    await auditService.record(auth, 'CREATE', 'Invoice', invoice.id);
    return { ...invoice, items: input.items };
  },

  async getInvoice(auth: TenantAuth, id: string) {
    const hospitalId = hid(auth);
    const invoice = await invoiceRepository.findById(hospitalId, id);
    if (!invoice) throw new AppError('Invoice not found.', 404);

    const [items, payments] = await Promise.all([
      prisma.invoiceItem.findMany({ where: { hospitalId, invoiceId: id } }),
      prisma.payment.findMany({ where: { hospitalId, invoiceId: id }, orderBy: { createdAt: 'asc' } }),
    ]);

    const claim = await prisma.insuranceClaim.findFirst({ where: { hospitalId, invoiceId: id } });

    return {
      ...invoice,
      items,
      payments,
      insuranceClaim: claim,
    };
  },

  async collectPayment(
    auth: TenantAuth,
    id: string,
    input: { amount: number; method: string; idempotencyKey?: string }
  ) {
    const hospitalId = hid(auth);
    const invoiceDetails = await this.getInvoice(auth, id);

    if (invoiceDetails.status === 'PAID') {
      throw new AppError('Invoice is already fully paid.', 400);
    }

    // Idempotency check: if key provided and payment already exists, return existing invoice
    if (input.idempotencyKey) {
      const existingPayment = await prisma.payment.findUnique({
        where: { hospitalId_idempotencyKey: { hospitalId, idempotencyKey: input.idempotencyKey } },
      });
      if (existingPayment) {
        return this.getInvoice(auth, id);
      }
    }

    const paidTotal = invoiceDetails.payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount),
      0
    );
    const remaining = Number(invoiceDetails.total) - paidTotal;

    if (input.amount <= 0 || input.amount > remaining) {
      throw new AppError(`Invalid payment amount. Remaining balance is ${remaining}.`, 400);
    }

    const isFullyPaid = input.amount === remaining;
    const newStatus = isFullyPaid ? 'PAID' : 'PENDING';

    // Atomically create payment record and update invoice status
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          hospitalId,
          invoiceId: id,
          amount: input.amount,
          method: input.method,
          status: 'COMPLETED',
          idempotencyKey: input.idempotencyKey ?? null,
        },
      }),
      prisma.invoice.update({
        where: { id },
        data: {
          status: newStatus,
          paidAt: isFullyPaid ? new Date() : null,
          updatedAt: new Date(),
        },
      }),
    ]);

    await auditService.record(auth, 'COLLECT_PAYMENT', 'Invoice', id);
    return this.getInvoice(auth, id);
  },

  async generateReceipt(auth: TenantAuth, id: string) {
    const hospitalId = hid(auth);
    const invoice = await this.getInvoice(auth, id);
    if (invoice.status !== 'PAID') throw new AppError('A receipt can only be generated for a paid invoice.', 400);
    const existing = await prisma.receipt.findUnique({ where: { hospitalId_invoiceId: { hospitalId, invoiceId: id } } });
    if (existing) return existing;
    const receipt = await prisma.receipt.create({ data: { hospitalId, invoiceId: id, receiptNumber: `RCT-${invoice.invoiceNumber}`, amount: invoice.total, issuedById: auth.userId } });
    await auditService.record(auth, 'CREATE', 'Receipt', receipt.id);
    return receipt;
  },

  async processRefund(auth: TenantAuth, id: string, amount: number) {
    const hospitalId = hid(auth);
    const invoiceDetails = await this.getInvoice(auth, id);

    const paidTotal = invoiceDetails.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const refundedTotal = (await prisma.refund.aggregate({ where: { hospitalId, invoiceId: id, status: 'COMPLETED' }, _sum: { amount: true } }))._sum.amount ?? 0;
    const refundable = paidTotal - Number(refundedTotal);
    if (amount <= 0 || amount > refundable) throw new AppError(`Invalid refund amount. Maximum refundable is ${refundable}.`, 400);
    const result = await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({ data: { hospitalId, invoiceId: id, amount, refundedById: auth.userId } });
      const nextStatus = amount === refundable ? 'REFUNDED' : 'PAID';
      await tx.invoice.update({ where: { id }, data: { status: nextStatus } });
      return refund;
    });
    await auditService.record(auth, 'REFUND', 'Invoice', id, { refundId: result.id });
    return this.getInvoice(auth, id);
  },

  async createInsuranceClaim(
    auth: TenantAuth,
    id: string,
    input: { provider: string; policyNumber: string; amountClaimed: number }
  ) {
    const hospitalId = hid(auth);
    const invoiceDetails = await this.getInvoice(auth, id);
    const existing = await prisma.insuranceClaim.findFirst({ where: { hospitalId, invoiceId: id, status: { in: ['PENDING', 'APPROVED'] } } });
    if (existing) throw new AppError('An active insurance claim already exists for this invoice.', 409);
    const claim = await prisma.insuranceClaim.create({ data: { hospitalId, patientId: invoiceDetails.patientId, invoiceId: id, claimNumber: `CLM-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`, providerName: input.provider, amount: input.amountClaimed } });
    await auditService.record(auth, 'CREATE_CLAIM', 'InsuranceClaim', claim.id);
    return claim;
  },

  async updateClaimStatus(auth: TenantAuth, id: string, status: string) {
    const hospitalId = hid(auth);
    if (!['PENDING', 'APPROVED', 'REJECTED', 'PAID'].includes(status)) throw new AppError('Invalid insurance claim status.', 400);
    const claim = await prisma.insuranceClaim.findFirst({ where: { hospitalId, OR: [{ id }, { invoiceId: id }] } });
    if (!claim) throw new AppError('Insurance claim not found.', 404);
    const updated = await prisma.insuranceClaim.update({ where: { id: claim.id }, data: { status: status as any, ...(status === 'APPROVED' ? { approvedAt: new Date(), approvedById: auth.userId } : {}), ...(status === 'REJECTED' ? { rejectedAt: new Date() } : {}) } });
    await auditService.record(auth, 'UPDATE_CLAIM_STATUS', 'InsuranceClaim', claim.id, { status });
    return updated;
  },

  async listInvoices(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      patientId?: string;
      status?: any;
      search?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      invoiceRepository.list(hospitalId, (page - 1) * limit, limit, query),
      invoiceRepository.count(hospitalId, query),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
