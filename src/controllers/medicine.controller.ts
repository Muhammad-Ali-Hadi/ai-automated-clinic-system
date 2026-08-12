import type { RequestHandler } from 'express';
import { medicineService } from '../services/medicine.service.js';
import { ok } from '../utils/api-response.js';

export const addMedicine: RequestHandler = async (req, res) =>
  ok(res, await medicineService.addMedicine(req.auth!, req.body), 'Medicine added.', 201);

export const getMedicine: RequestHandler = async (req, res) =>
  ok(res, await medicineService.getMedicine(req.auth!, String(req.params.id)), 'Medicine retrieved.');

export const updateMedicine: RequestHandler = async (req, res) =>
  ok(res, await medicineService.updateMedicine(req.auth!, String(req.params.id), req.body), 'Medicine updated.');

export const listMedicines: RequestHandler = async (req, res) => {
  const result = await medicineService.listMedicines(req.auth!, req.query as any);
  ok(res, result.data, 'Medicines retrieved.', 200, result.meta);
};

export const dispensePrescription: RequestHandler = async (req, res) =>
  ok(res, await medicineService.dispensePrescription(req.auth!, String(req.params.prescriptionId)), 'Prescription dispensed.');

export const createSupplier: RequestHandler = async (req, res) =>
  ok(res, await medicineService.createSupplier(req.auth!, req.body), 'Supplier created.', 201);

export const listSuppliers: RequestHandler = async (req, res) =>
  ok(res, await medicineService.listSuppliers(req.auth!), 'Suppliers retrieved.');

export const createPurchaseOrder: RequestHandler = async (req, res) =>
  ok(res, await medicineService.createPurchaseOrder(req.auth!, req.body), 'Purchase order created.', 201);

export const receiveStock: RequestHandler = async (req, res) =>
  ok(res, await medicineService.receiveStock(req.auth!, String(req.params.poId)), 'Stock received successfully.');

export const createMedicineBatch: RequestHandler = async (req, res) =>
  ok(res, await medicineService.createBatch(req.auth!, String(req.params.medicineId), req.body), 'Medicine batch created.', 201);

export const listMedicineBatches: RequestHandler = async (req, res) =>
  ok(res, await medicineService.listBatches(req.auth!, String(req.params.medicineId)), 'Medicine batches retrieved.');

export const listDispensingHistory: RequestHandler = async (req, res) => {
  const result = await medicineService.listDispensingHistory(req.auth!, req.query as any);
  ok(res, result.data, 'Dispensing history retrieved.', 200, result.meta);
};
