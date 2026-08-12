import type { RequestHandler } from 'express';
import { dischargeSummaryService } from '../services/discharge-summary.service.js';
import { ok } from '../utils/api-response.js';

export const createDischargeSummary: RequestHandler = async (req, res) =>
  ok(
    res,
    await dischargeSummaryService.create(req.auth!, String(req.params.patientId), req.body),
    'Discharge summary created.',
    201
  );

export const getDischargeSummary: RequestHandler = async (req, res) =>
  ok(
    res,
    await dischargeSummaryService.getLatest(req.auth!, String(req.params.patientId)),
    'Discharge summary retrieved.'
  );
