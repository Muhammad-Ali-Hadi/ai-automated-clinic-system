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

  // --- Supplier & Purchase Order JSON Registries in HospitalSettings ---
  async getSettings(hospitalId: string) {
    let settings = await prisma.hospitalSettings.findUnique({ where: { hospitalId } });
    if (!settings) {
      settings = await prisma.hospitalSettings.create({
        data: { hospitalId, preferences: {}, configuration: {} },
      });
    }
    return settings;
  },

  async listSuppliers(auth: TenantAuth) {
    const settings = await this.getSettings(hid(auth));
    const config = (settings.configuration as any) || {};
    return config.suppliers || [];
  },

  async createSupplier(auth: TenantAuth, input: { name: string; contactInfo: string }) {
    const hospitalId = hid(auth);
    const settings = await this.getSettings(hospitalId);
    const config = (settings.configuration as any) || {};
    const suppliers = config.suppliers || [];

    const newSupplier = { id: crypto.randomUUID(), ...input, createdAt: new Date() };
    suppliers.push(newSupplier);

    await prisma.hospitalSettings.update({
      where: { hospitalId },
      data: { configuration: { ...config, suppliers } },
    });

    await auditService.record(auth, 'CREATE', 'Supplier', newSupplier.id);
    return newSupplier;
  },

  async createPurchaseOrder(
    auth: TenantAuth,
    input: { supplierId: string; medicineId: string; quantity: number; unitCost: number }
  ) {
    const hospitalId = hid(auth);

    // Verify medicine exists and belongs to this hospital
    const medicine = await this.getMedicine(auth, input.medicineId);

    const po = await prisma.purchaseOrder.create({
      data: {
        hospitalId,
        medicineId: input.medicineId,
        supplierName: input.supplierId, // supplierId used as name for backward compat
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
