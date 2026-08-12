import type { RequestHandler } from 'express';
import { medicalRecordService } from '../services/medical-record.service.js';
import { ok } from '../utils/api-response.js';

export const createMedicalRecord: RequestHandler = async (req, res) =>
  ok(res, await medicalRecordService.create(req.auth!, req.body), 'Medical record created.', 201);

export const getMedicalRecord: RequestHandler = async (req, res) =>
  ok(res, await medicalRecordService.get(req.auth!, String(req.params.recordId)), 'Medical record retrieved.');

export const updateMedicalRecord: RequestHandler = async (req, res) =>
  ok(res, await medicalRecordService.update(req.auth!, String(req.params.recordId), req.body), 'Medical record updated.');

export const listMedicalRecords: RequestHandler = async (req, res) => {
  const result = await medicalRecordService.list(
    req.auth!,
    String(req.params.patientId),
    req.query as any
  );
  ok(res, result.data, 'Medical records retrieved.', 200, result.meta);
};

export const getMedicalTimeline: RequestHandler = async (req, res) =>
  ok(res, await medicalRecordService.getTimeline(req.auth!, String(req.params.patientId)), 'Medical timeline retrieved.');
