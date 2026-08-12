import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { invoiceRepository } from '../repositories/invoice.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { prisma } from '../lib/prisma.js';

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

    // Insurance claims still in JSON config (not migrated yet)
    const settings = await this.getSettings(hospitalId);
    const config = (settings.configuration as any) || {};
    const claim = (config.insuranceClaims || {})[id] || null;

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

    const paidTotal = invoiceDetails.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    if (amount <= 0 || amount > paidTotal) {
      throw new AppError(`Invalid refund amount. Maximum refundable is ${paidTotal}.`, 400);
    }

    await invoiceRepository.updateStatus(hospitalId, id, 'REFUNDED');

    // Record refund transaction in configuration
    const settings = await this.getSettings(hospitalId);
    const config = (settings.configuration as any) || {};
    const invoiceRefunds = config.invoiceRefunds || {};
    const refunds = invoiceRefunds[id] || [];

    const newRefund = {
      id: crypto.randomUUID(),
      amount,
      refundedAt: new Date(),
    };
    refunds.push(newRefund);
    invoiceRefunds[id] = refunds;

    await prisma.hospitalSettings.update({
      where: { hospitalId },
      data: { configuration: { ...config, invoiceRefunds } },
    });

    await auditService.record(auth, 'REFUND', 'Invoice', id, { refundId: newRefund.id });
    return this.getInvoice(auth, id);
  },

  async createInsuranceClaim(
    auth: TenantAuth,
    id: string,
    input: { provider: string; policyNumber: string; amountClaimed: number }
  ) {
    const hospitalId = hid(auth);
    const invoiceDetails = await this.getInvoice(auth, id);

    const settings = await this.getSettings(hospitalId);
    const config = (settings.configuration as any) || {};
    const insuranceClaims = config.insuranceClaims || {};

    const claim = {
      id: crypto.randomUUID(),
      provider: input.provider,
      policyNumber: input.policyNumber,
      amountClaimed: input.amountClaimed,
      status: 'SUBMITTED',
      createdAt: new Date(),
    };
    insuranceClaims[id] = claim;

    await prisma.hospitalSettings.update({
      where: { hospitalId },
      data: { configuration: { ...config, insuranceClaims } },
    });

    await auditService.record(auth, 'CREATE_CLAIM', 'Invoice', id, { claimId: claim.id });
    return claim;
  },

  async updateClaimStatus(auth: TenantAuth, id: string, status: string) {
    const hospitalId = hid(auth);
    const settings = await this.getSettings(hospitalId);
    const config = (settings.configuration as any) || {};
    const insuranceClaims = config.insuranceClaims || {};

    const claim = insuranceClaims[id];
    if (!claim) throw new AppError('Insurance claim not found.', 404);

    claim.status = status;
    claim.updatedAt = new Date();
    insuranceClaims[id] = claim;

    await prisma.hospitalSettings.update({
      where: { hospitalId },
      data: { configuration: { ...config, insuranceClaims } },
    });

    await auditService.record(auth, 'UPDATE_CLAIM_STATUS', 'Invoice', id, { status });
    return claim;
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
