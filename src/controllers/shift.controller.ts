import type { RequestHandler } from 'express';
import { shiftService } from '../services/shift.service.js';
import { ok } from '../utils/api-response.js';

export const createShift: RequestHandler = async (req, res) =>
  ok(res, await shiftService.createShift(req.auth!, req.body), 'Shift created.', 201);

export const listShifts: RequestHandler = async (req, res) =>
  ok(res, await shiftService.listShifts(req.auth!), 'Shifts retrieved.');

export const getShift: RequestHandler = async (req, res) =>
  ok(res, await shiftService.getShift(req.auth!, String(req.params.id)), 'Shift retrieved.');

export const updateShift: RequestHandler = async (req, res) =>
  ok(res, await shiftService.updateShift(req.auth!, String(req.params.id), req.body), 'Shift updated.');

export const assignShift: RequestHandler = async (req, res) =>
  ok(res, await shiftService.assignShift(req.auth!, String(req.params.id), req.body.userId), 'Shift assigned.', 201);

export const removeShiftAssignment: RequestHandler = async (req, res) =>
  ok(res, await shiftService.removeShiftAssignment(req.auth!, String(req.params.id), String(req.params.userId)), 'Shift assignment removed.');
