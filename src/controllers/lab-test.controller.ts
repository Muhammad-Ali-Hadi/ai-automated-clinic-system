import type { RequestHandler } from 'express';
import { labTestService } from '../services/lab-test.service.js';
import { ok } from '../utils/api-response.js';

export const createLabRequest: RequestHandler = async (req, res) =>
  ok(res, await labTestService.createRequest(req.auth!, req.body), 'Lab request created.', 201);

export const getLabRequest: RequestHandler = async (req, res) =>
  ok(res, await labTestService.getRequest(req.auth!, String(req.params.id)), 'Lab request retrieved.');

export const listLabRequests: RequestHandler = async (req, res) => {
  const result = await labTestService.listRequests(req.auth!, req.query as any);
  ok(res, result.data, 'Lab requests retrieved.', 200, result.meta);
};

export const collectSample: RequestHandler = async (req, res) =>
  ok(res, await labTestService.collectSample(req.auth!, String(req.params.id)), 'Sample collected.');

export const trackSample: RequestHandler = async (req, res) =>
  ok(res, await labTestService.startProcessing(req.auth!, String(req.params.id)), 'Sample processing started.');

export const recordResult: RequestHandler = async (req, res) =>
  ok(res, await labTestService.recordResult(req.auth!, String(req.params.id), req.body), 'Lab result recorded.');

export const approveLabResult: RequestHandler = async (req, res) =>
  ok(res, await labTestService.approveResult(req.auth!, String(req.params.id)), 'Laboratory result approved.');

export const rejectLabResult: RequestHandler = async (req, res) =>
  ok(res, await labTestService.rejectResult(req.auth!, String(req.params.id), req.body.reason), 'Lab result rejected.');

export const cancelLabRequest: RequestHandler = async (req, res) =>
  ok(res, await labTestService.cancelRequest(req.auth!, String(req.params.id)), 'Lab request cancelled.');

export const generateLabReport: RequestHandler = async (req, res) =>
  ok(res, await labTestService.generatePdfReport(req.auth!, String(req.params.id)), 'Lab report PDF generated.');
