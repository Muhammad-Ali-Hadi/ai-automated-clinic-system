import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const insuranceService = {
  async submitClaim(
    auth: TenantAuth,
    input: { patientId: string; invoiceId?: string; providerName: string; amount: number }
  ) {
    const hospitalId = hid(auth);
    const patient = await prisma.patient.findFirst({ where: { id: input.patientId, hospitalId } });
    if (!patient) throw new AppError('Patient not found.', 404);

    if (input.invoiceId) {
      const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, hospitalId } });
      if (!invoice) throw new AppError('Invoice not found.', 404);
    }

    const claimNumber = `CLM-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    const claim = await prisma.insuranceClaim.create({
      data: {
        hospitalId,
        patientId: input.patientId,
        invoiceId: input.invoiceId,
        providerName: input.providerName,
        amount: input.amount,
        claimNumber,
      },
    });
    await auditService.record(auth, 'SUBMIT_CLAIM', 'InsuranceClaim', claim.id);
    return claim;
  },

  async getClaim(auth: TenantAuth, id: string) {
    const claim = await prisma.insuranceClaim.findFirst({ where: { id, hospitalId: hid(auth) } });
    if (!claim) throw new AppError('Insurance claim not found.', 404);
    return claim;
  },

  async listClaims(
    auth: TenantAuth,
    query: { page?: number; limit?: number; patientId?: string; status?: string; providerName?: string }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      hospitalId,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.providerName ? { providerName: { contains: query.providerName, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { submittedAt: 'desc' },
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.insuranceClaim.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async approveClaim(auth: TenantAuth, id: string) {
    const claim = await this.getClaim(auth, id);
    if (claim.status !== 'PENDING') throw new AppError('Only PENDING claims can be approved.', 400);
    await prisma.insuranceClaim.updateMany({
      where: { id, hospitalId: hid(auth) },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: auth.userId },
    });
    await auditService.record(auth, 'APPROVE_CLAIM', 'InsuranceClaim', id);
    return this.getClaim(auth, id);
  },

  async rejectClaim(auth: TenantAuth, id: string, reason: string) {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new AppError('Rejection reason is required.', 400);
    const claim = await this.getClaim(auth, id);
    if (claim.status !== 'PENDING') throw new AppError('Only PENDING claims can be rejected.', 400);
    await prisma.insuranceClaim.updateMany({
      where: { id, hospitalId: hid(auth) },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: trimmedReason },
    });
    await auditService.record(auth, 'REJECT_CLAIM', 'InsuranceClaim', id, { reason: trimmedReason });
    return this.getClaim(auth, id);
  },
};
