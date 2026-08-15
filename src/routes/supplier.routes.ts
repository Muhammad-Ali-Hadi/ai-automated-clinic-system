import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createSupplier, listSuppliers, getSupplier } from '../controllers/supplier.controller.js';

export const supplierRouter = Router();
supplierRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const adminOnly = authorize('HOSPITAL_ADMIN');

supplierRouter.post(
  '/',
  adminOnly,
  validate(envelope.extend({
    body: z.object({
      name: z.string().min(1).max(200),
      contactName: z.string().max(200).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(30).optional(),
      address: z.string().max(500).optional(),
    }),
  })),
  createSupplier
);

supplierRouter.get(
  '/',
  adminOnly,
  validate(envelope.extend({
    query: z.object({ search: z.string().optional() }),
  })),
  listSuppliers
);

supplierRouter.get(
  '/:id',
  adminOnly,
  validate(envelope.extend({ params: z.object({ id: z.string().uuid() }) })),
  getSupplier
);
