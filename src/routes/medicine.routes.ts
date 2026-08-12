import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  addMedicine,
  createPurchaseOrder,
  createSupplier,
  dispensePrescription,
  getMedicine,
  listMedicines,
  listSuppliers,
  receiveStock,
  updateMedicine,
  createMedicineBatch,
  listMedicineBatches,
  listDispensingHistory,
} from '../controllers/medicine.controller.js';

export const medicineRouter = Router();
medicineRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const idParam = z.object({ id: z.string().uuid() });

const pharmacistOnly = authorize('HOSPITAL_ADMIN', 'PHARMACIST');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'RECEPTIONIST');

medicineRouter.post(
  '/',
  pharmacistOnly,
  validate(
    envelope.extend({
      body: z.object({
        name: z.string().min(2).max(200),
        category: z.string().max(100).optional(),
        sku: z.string().min(2).max(100),
        quantity: z.number().int().nonnegative().default(0),
        reorderLevel: z.number().int().nonnegative().default(10),
        unitPrice: z.number().positive(),
        expiresAt: z.string().datetime({ offset: true }).optional(),
      }),
    })
  ),
  addMedicine
);

medicineRouter.get(
  '/',
  staffAll,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        category: z.string().max(100).optional(),
        search: z.string().max(100).optional(),
        lowStockOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
        expiredOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
      }),
    })
  ),
  listMedicines
);

medicineRouter.get('/dispensing-history', staffAll, validate(envelope.extend({ query: z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20), patientId: z.string().uuid().optional(), medicineId: z.string().uuid().optional() }) })), listDispensingHistory);

medicineRouter.post('/batches/:medicineId', pharmacistOnly, validate(envelope.extend({ params: z.object({ medicineId: z.string().uuid() }), body: z.object({ batchNumber: z.string().min(1).max(100), quantity: z.number().int().positive(), expiresAt: z.string().datetime({ offset: true }).optional() }) })), createMedicineBatch);

medicineRouter.get('/batches/:medicineId', staffAll, validate(envelope.extend({ params: z.object({ medicineId: z.string().uuid() }) })), listMedicineBatches);

medicineRouter.get(
  '/:id',
  staffAll,
  validate(envelope.extend({ params: idParam })),
  getMedicine
);

medicineRouter.patch(
  '/:id',
  pharmacistOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z
        .object({
          name: z.string().min(2).max(200).optional(),
          category: z.string().max(100).optional(),
          sku: z.string().min(2).max(100).optional(),
          quantity: z.number().int().nonnegative().optional(),
          reorderLevel: z.number().int().nonnegative().optional(),
          unitPrice: z.number().positive().optional(),
          expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field to update'),
    })
  ),
  updateMedicine
);

medicineRouter.post(
  '/dispense/:prescriptionId',
  pharmacistOnly,
  validate(envelope.extend({ params: z.object({ prescriptionId: z.string().uuid() }) })),
  dispensePrescription
);

// Supplier CRUD
medicineRouter.post(
  '/suppliers',
  pharmacistOnly,
  validate(
    envelope.extend({
      body: z.object({
        name: z.string().min(2).max(200),
        contactInfo: z.string().max(300),
      }),
    })
  ),
  createSupplier
);

medicineRouter.get(
  '/suppliers/list',
  pharmacistOnly,
  listSuppliers
);

// Purchase Orders
medicineRouter.post(
  '/purchase-orders',
  pharmacistOnly,
  validate(
    envelope.extend({
      body: z.object({
        supplierId: z.string().min(1),
        medicineId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitCost: z.number().nonnegative().default(0),
      }),
    })
  ),
  createPurchaseOrder
);

medicineRouter.post(
  '/purchase-orders/:poId/receive',
  pharmacistOnly,
  validate(envelope.extend({ params: z.object({ poId: z.string().uuid() }) })),
  receiveStock
);
