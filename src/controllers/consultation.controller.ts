import type { RequestHandler } from 'express';
import { consultationService } from '../services/consultation.service.js';
import { ok } from '../utils/api-response.js';

export const createConsultation: RequestHandler = async (req, res) =>
  ok(res, await consultationService.create(req.auth!, req.body), 'Consultation created.', 201);

export const getConsultation: RequestHandler = async (req, res) =>
  ok(res, await consultationService.get(req.auth!, String(req.params.consultationId)), 'Consultation retrieved.');

export const updateConsultation: RequestHandler = async (req, res) =>
  ok(res, await consultationService.update(req.auth!, String(req.params.consultationId), req.body), 'Consultation updated.');

export const listConsultations: RequestHandler = async (req, res) => {
  const result = await consultationService.list(req.auth!, req.query as any);
  ok(res, result.data, 'Consultations retrieved.', 200, result.meta);
};
