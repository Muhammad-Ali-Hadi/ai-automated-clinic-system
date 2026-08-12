import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoiceService } from '../services/invoice.service.js';
import { invoiceRepository } from '../repositories/invoice.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/invoice.repository.js', () => ({
  invoiceRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByInvoiceNumber: vi.fn(),
    updateStatus: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../repositories/patient.repository.js', () => ({
  patientRepository: { findById: vi.fn() },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    hospitalSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      create: vi.fn(),
      update: vi.fn(),
    },
    invoiceItem: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (arg) => {
      if (typeof arg === 'function') {
        const txClient = {
          invoice: {
            create: vi.fn().mockImplementation((args) => prisma.invoice.create(args)),
          },
          invoiceItem: {
            createMany: vi.fn().mockImplementation((args) => prisma.invoiceItem.createMany(args)),
          },
          payment: {
            create: vi.fn().mockImplementation((args) => prisma.payment.create(args)),
          },
        };
        return arg(txClient);
      }
      return Promise.all(arg);
    }),
  },
}));

describe('Billing Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'ACCOUNTANT' as const,
  };

  const mockSettings = {
    hospitalId: 'hospital-uuid-abc',
    configuration: {
      invoiceItems: {},
      invoicePayments: {},
      invoiceRefunds: {},
      insuranceClaims: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.hospitalSettings.findUnique).mockResolvedValue(mockSettings as any);
    vi.mocked(prisma.hospitalSettings.update).mockResolvedValue(mockSettings as any);
  });

  it('generates an invoice successfully', async () => {
    vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(invoiceRepository.findByInvoiceNumber).mockResolvedValue(null);
    vi.mocked(prisma.invoice.create).mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      subtotal: 100,
      discount: 10,
      total: 90,
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.invoiceItem.createMany).mockResolvedValue({ count: 1 } as any);

    // Also need mock for invoiceRepository.create just in case it is still called
    vi.mocked(invoiceRepository.create).mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      subtotal: 100,
      discount: 10,
      total: 90,
      status: 'PENDING',
    } as any);

    const result = await invoiceService.generateInvoice(mockAuth, {
      patientId: 'patient-1',
      invoiceNumber: 'INV-001',
      items: [{ name: 'Consultation', quantity: 1, unitPrice: 100 }],
      discount: 10,
    });

    expect(result.invoiceNumber).toBe('INV-001');
  });

  it('prevents duplicate invoice numbers', async () => {
    vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(invoiceRepository.findByInvoiceNumber).mockResolvedValue({ id: 'existing' } as any);

    await expect(
      invoiceService.generateInvoice(mockAuth, {
        patientId: 'patient-1',
        invoiceNumber: 'INV-001',
        items: [{ name: 'Consultation', quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toThrow(new AppError('Invoice number already exists.', 409));
  });

  it('rejects overpayment', async () => {
    vi.mocked(invoiceRepository.findById).mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      total: 50,
    } as any);

    vi.mocked(prisma.invoiceItem.findMany).mockResolvedValue([
      { name: 'Test', quantity: 1, unitPrice: 50 }
    ] as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as any);

    await expect(
      invoiceService.collectPayment(mockAuth, 'inv-1', { amount: 200, method: 'CASH' })
    ).rejects.toThrow(new AppError('Invalid payment amount. Remaining balance is 50.', 400));
  });
});
