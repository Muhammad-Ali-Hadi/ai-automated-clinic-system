import type { RequestHandler } from 'express';
import { insuranceService } from '../services/insurance.service.js';
import { ok } from '../utils/api-response.js';

export const submitClaim: RequestHandler = async (req, res) =>
  ok(res, await insuranceService.submitClaim(req.auth!, req.body), 'Insurance claim submitted successfully.', 201);

export const listClaims: RequestHandler = async (req, res) => {
  const result = await insuranceService.listClaims(req.auth!, req.query as any);
  ok(res, result.data, 'Insurance claims retrieved.', 200, result.meta);
};

export const getClaim: RequestHandler = async (req, res) =>
  ok(res, await insuranceService.getClaim(req.auth!, String(req.params.id)), 'Insurance claim retrieved.');

export const approveClaim: RequestHandler = async (req, res) =>
  ok(res, await insuranceService.approveClaim(req.auth!, String(req.params.id)), 'Insurance claim approved.');

export const rejectClaim: RequestHandler = async (req, res) =>
  ok(res, await insuranceService.rejectClaim(req.auth!, String(req.params.id), req.body.reason), 'Insurance claim rejected.');

