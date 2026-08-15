import type { RequestHandler } from 'express';
import { supplierService } from '../services/supplier.service.js';
import { ok } from '../utils/api-response.js';

export const createSupplier: RequestHandler = async (req, res) =>
  ok(res, await supplierService.createSupplier(req.auth!, req.body), 'Supplier created.', 201);

export const listSuppliers: RequestHandler = async (req, res) =>
  ok(res, await supplierService.listSuppliers(req.auth!, req.query as any), 'Suppliers retrieved.');

export const getSupplier: RequestHandler = async (req, res) =>
  ok(res, await supplierService.getSupplier(req.auth!, String(req.params.id)), 'Supplier retrieved.');
