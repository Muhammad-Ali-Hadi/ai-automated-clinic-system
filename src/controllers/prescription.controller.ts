import type { RequestHandler } from 'express';
import { prescriptionService } from '../services/prescription.service.js';
import { ok } from '../utils/api-response.js';

export const createPrescription: RequestHandler = async (req, res) =>
  ok(res, await prescriptionService.create(req.auth!, req.body), 'Prescription created.', 201);

export const getPrescription: RequestHandler = async (req, res) =>
  ok(res, await prescriptionService.get(req.auth!, String(req.params.prescriptionId)), 'Prescription retrieved.');

export const listPrescriptions: RequestHandler = async (req, res) => {
  const result = await prescriptionService.list(req.auth!, req.query as any);
  ok(res, result.data, 'Prescriptions retrieved.', 200, result.meta);
};
