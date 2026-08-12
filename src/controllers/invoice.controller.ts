import type { RequestHandler } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import { ok } from '../utils/api-response.js';

export const generateInvoice: RequestHandler = async (req, res) =>
  ok(res, await invoiceService.generateInvoice(req.auth!, req.body), 'Invoice generated.', 201);

export const getInvoice: RequestHandler = async (req, res) =>
  ok(res, await invoiceService.getInvoice(req.auth!, String(req.params.id)), 'Invoice retrieved.');

export const listInvoices: RequestHandler = async (req, res) => {
  const result = await invoiceService.listInvoices(req.auth!, req.query as any);
  ok(res, result.data, 'Invoices retrieved.', 200, result.meta);
};

export const collectPayment: RequestHandler = async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  ok(
    res,
    await invoiceService.collectPayment(req.auth!, String(req.params.id), {
      ...req.body,
      idempotencyKey,
    }),
    'Payment recorded.'
  );
};

export const processRefund: RequestHandler = async (req, res) =>
  ok(res, await invoiceService.processRefund(req.auth!, String(req.params.id), Number(req.body.amount)), 'Refund processed.');

export const createInsuranceClaim: RequestHandler = async (req, res) =>
  ok(res, await invoiceService.createInsuranceClaim(req.auth!, String(req.params.id), req.body), 'Insurance claim submitted.', 201);

export const updateClaimStatus: RequestHandler = async (req, res) =>
  ok(res, await invoiceService.updateClaimStatus(req.auth!, String(req.params.id), req.body.status), 'Insurance claim status updated.');

export const generateReceipt: RequestHandler = async (req, res) =>
  ok(res, await invoiceService.generateReceipt(req.auth!, String(req.params.id)), 'Receipt generated.');
