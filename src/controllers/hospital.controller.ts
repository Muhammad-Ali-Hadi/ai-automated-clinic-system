import type { RequestHandler } from 'express';
import { hospitalService } from '../services/hospital.service.js';
import { ok } from '../utils/api-response.js';

export const getHospital: RequestHandler = async (req, res) =>
  ok(res, await hospitalService.profile(req.auth!), 'Hospital retrieved.');

export const updateHospital: RequestHandler = async (req, res) =>
  ok(res, await hospitalService.updateProfile(req.auth!, req.body), 'Hospital updated.');

export const updateSettings: RequestHandler = async (req, res) =>
  ok(res, await hospitalService.updateSettings(req.auth!, req.body), 'Hospital settings updated.');

export const createBranch: RequestHandler = async (req, res) =>
  ok(res, await hospitalService.createBranch(req.auth!, req.body), 'Branch created.', 201);

export const listBranches: RequestHandler = async (req, res) => {
  const result = await hospitalService.listBranches(req.auth!, req.query as never);
  ok(res, result.data, 'Branches retrieved.', 200, result.meta);
};

export const updateBranch: RequestHandler = async (req, res) =>
  ok(
    res,
    await hospitalService.updateBranch(req.auth!, String(req.params.branchId), req.body),
    'Branch updated.'
  );

export const deleteBranch: RequestHandler = async (req, res) => {
  await hospitalService.deleteBranch(req.auth!, String(req.params.branchId));
  ok(res, null, 'Branch deleted.');
};

export const replaceWorkingHours: RequestHandler = async (req, res) =>
  ok(
    res,
    await hospitalService.replaceWorkingHours(
      req.auth!,
      String(req.params.branchId),
      req.body.hours
    ),
    'Working hours updated.'
  );
