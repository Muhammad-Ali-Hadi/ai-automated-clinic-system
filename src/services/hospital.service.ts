import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { hospitalRepository } from '../repositories/hospital.repository.js';

const tenant = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const hospitalService = {
  async profile(auth: TenantAuth) {
    const hospital = await hospitalRepository.profile(tenant(auth));
    if (!hospital) throw new AppError('Hospital not found.', 404);
    return hospital;
  },

  async updateProfile(auth: TenantAuth, input: { name?: string; isActive?: boolean }) {
    const hospital = await hospitalRepository.updateProfile(tenant(auth), input);
    await auditService.record(auth, 'UPDATE', 'Hospital', hospital.id);
    return hospital;
  },

  async updateSettings(
    auth: TenantAuth,
    input: {
      preferences?: object;
      configuration?: object;
      subscriptionPlan?: string;
      subscriptionEndsAt?: string | null;
      logoKey?: string | null;
    }
  ) {
    const settings = await hospitalRepository.upsertSettings(tenant(auth), {
      ...input,
      subscriptionEndsAt:
        input.subscriptionEndsAt === undefined
          ? undefined
          : input.subscriptionEndsAt === null
            ? null
            : new Date(input.subscriptionEndsAt),
    });
    await auditService.record(auth, 'UPDATE', 'HospitalSettings', settings.id);
    return settings;
  },

  async createBranch(
    auth: TenantAuth,
    input: { name: string; address?: string; phone?: string }
  ) {
    const branch = await hospitalRepository.createBranch({ hospitalId: tenant(auth), ...input });
    await auditService.record(auth, 'CREATE', 'Branch', branch.id);
    return branch;
  },

  async listBranches(
    auth: TenantAuth,
    query: { page?: number; limit?: number; search?: string }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const hospitalId = tenant(auth);
    const [data, total] = await Promise.all([
      hospitalRepository.listBranches(hospitalId, (page - 1) * limit, limit, query.search),
      hospitalRepository.countBranches(hospitalId, query.search),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateBranch(
    auth: TenantAuth,
    branchId: string,
    input: { name?: string; address?: string; phone?: string; isActive?: boolean }
  ) {
    const existing = await hospitalRepository.branch(tenant(auth), branchId);
    if (!existing) throw new AppError('Branch not found.', 404);
    const result = await hospitalRepository.updateBranch(tenant(auth), branchId, input);
    await auditService.record(auth, 'UPDATE', 'Branch', branchId);
    return result;
  },

  async deleteBranch(auth: TenantAuth, branchId: string) {
    const existing = await hospitalRepository.branch(tenant(auth), branchId);
    if (!existing) throw new AppError('Branch not found.', 404);
    await hospitalRepository.deleteBranch(tenant(auth), branchId);
    await auditService.record(auth, 'DELETE', 'Branch', branchId);
  },

  async replaceWorkingHours(
    auth: TenantAuth,
    branchId: string,
    hours: { weekday: number; opensAt: string; closesAt: string; isClosed?: boolean }[]
  ) {
    if (!(await hospitalRepository.branch(tenant(auth), branchId)))
      throw new AppError('Branch not found.', 404);
    const result = await hospitalRepository.replaceWorkingHours(branchId, hours);
    await auditService.record(auth, 'UPDATE', 'WorkingHour', branchId);
    return result;
  },
};
