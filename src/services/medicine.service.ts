import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { medicineRepository } from '../repositories/medicine.repository.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const medicineService = {
  async addMedicine(
    auth: TenantAuth,
    input: {
      name: string;
      category?: string;
      sku: string;
      quantity?: number;
      reorderLevel?: number;
      unitPrice: number;
      expiresAt?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const existing = await medicineRepository.findBySku(hospitalId, input.sku);
    if (existing) throw new AppError('Medicine SKU already exists in this hospital.', 409);

    const medicine = await medicineRepository.create({
      ...input,
      hospitalId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });

    await auditService.record(auth, 'CREATE', 'Medicine', medicine.id);
    return medicine;
  },

  async getMedicine(auth: TenantAuth, id: string) {
    const medicine = await medicineRepository.findById(hid(auth), id);
    if (!medicine) throw new AppError('Medicine not found.', 404);
    return medicine;
  },

  async updateMedicine(
    auth: TenantAuth,
    id: string,
    input: {
      name?: string;
      category?: string;
      sku?: string;
      quantity?: number;
      reorderLevel?: number;
      unitPrice?: number;
      expiresAt?: string | null;
    }
  ) {
    await this.getMedicine(auth, id);
    const result = await medicineRepository.update(hid(auth), id, {
      ...input,
      expiresAt:
        input.expiresAt === null ? null : input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    if (!result.count) throw new AppError('Medicine not found.', 404);
    await auditService.record(auth, 'UPDATE', 'Medicine', id);
    return this.getMedicine(auth, id);
  },

  async listMedicines(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      lowStockOnly?: boolean;
      expiredOnly?: boolean;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      medicineRepository.list(hospitalId, (page - 1) * limit, limit, query),
      medicineRepository.count(hospitalId, query),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async dispensePrescription(auth: TenantAuth, prescriptionId: string) {
    const hospitalId = hid(auth);
    // Find the prescription
    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, hospitalId },
    });
    if (!prescription) throw new AppError('Prescription not found.', 404);

    // Find the medicine by name
    const medicine = await prisma.medicine.findFirst({
      where: {
        hospitalId,
        name: { equals: prescription.medicineName, mode: 'insensitive' },
      },
    });
    if (!medicine) throw new AppError(`Medicine ${prescription.medicineName} is not available in inventory.`, 404);

    const result = await prisma.$transaction(async (tx) => {
      const deducted = await tx.medicine.updateMany({
        where: { id: medicine.id, hospitalId, quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (deducted.count === 0) {
        throw new AppError(`Insufficient stock for medicine: ${prescription.medicineName}`, 400);
      }
      const record = await tx.dispenseRecord.create({
        data: {
          hospitalId,
          patientId: prescription.patientId,
          medicineId: medicine.id,
          prescriptionId,
          dispensedById: auth.userId,
          quantity: 1,
        },
      });
      return { record, remainingStock: medicine.quantity - 1 };
    });

    await auditService.record(auth, 'DISPENSE_PRESCRIPTION', 'Prescription', prescriptionId);
    return {
      success: true,
      dispensedMedicine: medicine.name,
      remainingStock: result.remainingStock,
      dispenseRecordId: result.record.id,
    };

  },
  async createBatch(auth: TenantAuth, medicineId: string, input: { batchNumber: string; quantity: number; expiresAt?: string }) {
    const hospitalId = hid(auth);
    const medicine = await this.getMedicine(auth, medicineId);
    const batch = await prisma.medicineBatch.create({ data: { hospitalId, medicineId, batchNumber: input.batchNumber, quantity: input.quantity, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined } });
    await auditService.record(auth, 'CREATE', 'MedicineBatch', batch.id);
    return { ...batch, medicineName: medicine.name };
  },

  async listBatches(auth: TenantAuth, medicineId: string) {
    await this.getMedicine(auth, medicineId);
    return prisma.medicineBatch.findMany({ where: { hospitalId: hid(auth), medicineId }, orderBy: { expiresAt: 'asc' } });
  },

  async listDispensingHistory(auth: TenantAuth, query: { page?: number; limit?: number; patientId?: string; medicineId?: string }) {
    const hospitalId = hid(auth); const page = query.page ?? 1; const limit = query.limit ?? 20;
    const where = { hospitalId, ...(query.patientId ? { patientId: query.patientId } : {}), ...(query.medicineId ? { medicineId: query.medicineId } : {}) };
    const [data, total] = await Promise.all([prisma.dispenseRecord.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { dispensedAt: 'desc' } }), prisma.dispenseRecord.count({ where })]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async listSuppliers(auth: TenantAuth) {
    return prisma.supplier.findMany({ where: { hospitalId: hid(auth), isActive: true }, orderBy: { name: 'asc' } });
  },

  async createSupplier(auth: TenantAuth, input: { name: string; contactInfo: string }) {
    const hospitalId = hid(auth);
    const existing = await prisma.supplier.findFirst({ where: { hospitalId, name: input.name } });
    if (existing) throw new AppError('Supplier already exists in this hospital.', 409);
    const supplier = await prisma.supplier.create({ data: { hospitalId, name: input.name, contactName: input.contactInfo } });
    await auditService.record(auth, 'CREATE', 'Supplier', supplier.id);
    return supplier;
  },

  async createPurchaseOrder(
    auth: TenantAuth,
    input: { supplierId: string; medicineId: string; quantity: number; unitCost: number }
  ) {
    const hospitalId = hid(auth);

    const medicine = await this.getMedicine(auth, input.medicineId);
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, hospitalId, isActive: true } });
    if (!supplier) throw new AppError('Supplier not found.', 404);

    const po = await prisma.purchaseOrder.create({
      data: {
        hospitalId,
        medicineId: input.medicineId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        quantity: input.quantity,
        unitCost: input.unitCost ?? 0,
        status: 'PENDING',
      },
    });

    await auditService.record(auth, 'CREATE', 'PurchaseOrder', po.id);
    return { ...po, medicineName: medicine.name };
  },

  async receiveStock(auth: TenantAuth, poId: string) {
    const hospitalId = hid(auth);

    // Load PO and verify it exists and is PENDING
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, hospitalId, status: 'PENDING' },
    });
    if (!po) throw new AppError('Purchase order not found or already received.', 404);

    // Atomically update stock and mark PO received
    const [updatedPO] = await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      }),
      prisma.medicine.update({
        where: { id: po.medicineId },
        data: { quantity: { increment: po.quantity } },
      }),
    ]);

    await auditService.record(auth, 'RECEIVE_STOCK', 'PurchaseOrder', poId);
    return { success: true, purchaseOrderId: poId, quantityAdded: po.quantity };
  },
};
