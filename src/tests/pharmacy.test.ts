import { describe, expect, it, vi, beforeEach } from 'vitest';
import { medicineService } from '../services/medicine.service.js';
import { medicineRepository } from '../repositories/medicine.repository.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/medicine.repository.js', () => ({
  medicineRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findBySku: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    prescription: { findFirst: vi.fn() },
    medicine: { findFirst: vi.fn(), updateMany: vi.fn() },
    hospitalSettings: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    dispenseRecord: { create: vi.fn().mockResolvedValue({ id: 'dispense-1' }) },
    $transaction: vi.fn(async (callback: any) => callback({ medicine: { updateMany: (...args: any[]) => (prisma.medicine.updateMany as any)(...args) }, dispenseRecord: { create: (...args: any[]) => (prisma.dispenseRecord.create as any)(...args) } })),
  },
}));

describe('Pharmacy Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'PHARMACIST' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a medicine successfully', async () => {
    vi.mocked(medicineRepository.findBySku).mockResolvedValue(null);
    vi.mocked(medicineRepository.create).mockResolvedValue({ id: 'med-1', name: 'Aspirin' } as any);

    const result = await medicineService.addMedicine(mockAuth, {
      name: 'Aspirin',
      sku: 'SKU-ASP',
      unitPrice: 10,
    });

    expect(result.id).toBe('med-1');
  });

  it('dispenses prescription and decrements stock', async () => {
    const mockPresc = { id: 'presc-1', hospitalId: 'hospital-uuid-abc', medicineName: 'Aspirin' };
    const mockMed = { id: 'med-1', hospitalId: 'hospital-uuid-abc', name: 'Aspirin', quantity: 5 };

    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(mockPresc as any);
    vi.mocked(prisma.medicine.findFirst).mockResolvedValue(mockMed as any);
    vi.mocked(prisma.medicine.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await medicineService.dispensePrescription(mockAuth, 'presc-1');
    expect(result.success).toBe(true);
    expect(prisma.medicine.updateMany).toHaveBeenCalledWith({
      where: { id: 'med-1', hospitalId: 'hospital-uuid-abc', quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } },
    });
  });

  it('throws AppError if insufficient stock during dispensing', async () => {
    const mockPresc = { id: 'presc-1', hospitalId: 'hospital-uuid-abc', medicineName: 'Aspirin' };
    const mockMed = { id: 'med-1', hospitalId: 'hospital-uuid-abc', name: 'Aspirin', quantity: 0 };

    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(mockPresc as any);
    vi.mocked(prisma.medicine.findFirst).mockResolvedValue(mockMed as any);
    vi.mocked(prisma.medicine.updateMany).mockResolvedValue({ count: 0 } as any);

    await expect(medicineService.dispensePrescription(mockAuth, 'presc-1')).rejects.toThrow(
      new AppError('Insufficient stock for medicine: Aspirin', 400)
    );
  });
});
