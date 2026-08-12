import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { labTestRepository } from '../repositories/lab-test.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import type { LabRequestStatus } from '@prisma/client';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

const VALID_TRANSITIONS: Record<LabRequestStatus, LabRequestStatus[]> = {
  REQUESTED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const labTestService = {
  async createRequest(
    auth: TenantAuth,
    input: {
      patientId: string;
      testName: string;
      referenceRange?: string;
    }
  ) {
    const hospitalId = hid(auth);
    // Verify patient
    const patient = await patientRepository.findById(hospitalId, input.patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const test = await labTestRepository.create({
      hospitalId,
      patientId: input.patientId,
      requestedById: auth.userId,
      testName: input.testName,
      referenceRange: input.referenceRange,
      barcode: `LAB-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}` ,
    });

    await auditService.record(auth, 'CREATE', 'LabTest', test.id);
    return test;
  },

  async getRequest(auth: TenantAuth, id: string) {
    const test = await labTestRepository.findById(hid(auth), id);
    if (!test) throw new AppError('Laboratory request not found.', 404);
    return test;
  },

  async listRequests(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      patientId?: string;
      status?: LabRequestStatus;
      search?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = {
      patientId: query.patientId,
      status: query.status,
      search: query.search,
    };

    const [data, total] = await Promise.all([
      labTestRepository.list(hospitalId, (page - 1) * limit, limit, filters),
      labTestRepository.count(hospitalId, filters),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async collectSample(auth: TenantAuth, id: string) {
    const test = await this.getRequest(auth, id);
    if (!VALID_TRANSITIONS[test.status].includes('COLLECTED')) {
      throw new AppError(`Cannot collect sample for request in ${test.status} status.`, 400);
    }

    await labTestRepository.updateStatus(hid(auth), id, 'COLLECTED', {
      collectedAt: new Date(),
    });
    await auditService.record(auth, 'COLLECT_SAMPLE', 'LabTest', id);
    return this.getRequest(auth, id);
  },

  async startProcessing(auth: TenantAuth, id: string) {
    const test = await this.getRequest(auth, id);
    if (!VALID_TRANSITIONS[test.status].includes('PROCESSING')) {
      throw new AppError(`Cannot start processing for request in ${test.status} status.`, 400);
    }

    await labTestRepository.updateStatus(hid(auth), id, 'PROCESSING');
    await auditService.record(auth, 'START_PROCESSING', 'LabTest', id);
    return this.getRequest(auth, id);
  },

  async recordResult(
    auth: TenantAuth,
    id: string,
    input: { result: string; referenceRange?: string }
  ) {
    const test = await this.getRequest(auth, id);
    if (test.status !== 'PROCESSING') {
      throw new AppError('Can only record results when request is in PROCESSING status.', 400);
    }

    await labTestRepository.updateStatus(hid(auth), id, 'COMPLETED', {
      result: input.result,
      referenceRange: input.referenceRange ?? test.referenceRange ?? undefined,
      approvedAt: undefined,
    });
    await auditService.record(auth, 'RECORD_RESULT', 'LabTest', id);
    return this.getRequest(auth, id);
  },

  async approveResult(auth: TenantAuth, id: string) {
    const test = await this.getRequest(auth, id);
    if (test.status !== 'COMPLETED' || test.approvedAt) throw new AppError('Only an unapproved completed result can be approved.', 400);
    await labTestRepository.updateStatus(hid(auth), id, 'COMPLETED', { approvedAt: new Date() });
    await auditService.record(auth, 'APPROVE_RESULT', 'LabTest', id);
    return this.getRequest(auth, id);
  },

  async rejectResult(auth: TenantAuth, id: string, reason: string) {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new AppError('Rejection reason is required.', 400);
    const test = await this.getRequest(auth, id);
    if (test.status !== 'PROCESSING') throw new AppError('Can only reject results when request is in PROCESSING status.', 400);
    await labTestRepository.updateStatus(hid(auth), id, 'CANCELLED', { rejectionReason: trimmedReason, rejectedAt: new Date() });
    await auditService.record(auth, 'REJECT_RESULT', 'LabTest', id, { reason: trimmedReason });
    return this.getRequest(auth, id);
  },

  async cancelRequest(auth: TenantAuth, id: string) {
    const test = await this.getRequest(auth, id);
    if (!VALID_TRANSITIONS[test.status].includes('CANCELLED')) {
      throw new AppError(`Cannot cancel request in ${test.status} status.`, 400);
    }

    await labTestRepository.updateStatus(hid(auth), id, 'CANCELLED');
    await auditService.record(auth, 'CANCEL', 'LabTest', id);
    return this.getRequest(auth, id);
  },

  async generatePdfReport(auth: TenantAuth, id: string) {
    const test = await this.getRequest(auth, id);
    if (test.status !== 'COMPLETED') {
      throw new AppError('Report can only be generated for COMPLETED laboratory tests.', 400);
    }
    // Simulate generation of a secure report URL
    return {
      reportUrl: `https://storage.renovia.local/hospitals/${hid(auth)}/reports/lab-${id}.pdf`,
      generatedAt: new Date(),
    };
  },
};
