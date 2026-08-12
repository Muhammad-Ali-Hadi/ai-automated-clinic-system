import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  collectPayment,
  createInsuranceClaim,
  generateInvoice,
  generateReceipt,
  getInvoice,
  listInvoices,
  processRefund,
  updateClaimStatus,
} from '../controllers/invoice.controller.js';

export const invoiceRouter = Router();
invoiceRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const idParam = z.object({ id: z.string().uuid() });

const accountantOnly = authorize('HOSPITAL_ADMIN', 'ACCOUNTANT');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ACCOUNTANT');

invoiceRouter.post(
  '/',
  accountantOnly,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        invoiceNumber: z.string().min(2).max(100),
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(200),
              quantity: z.number().int().positive(),
              unitPrice: z.number().positive(),
            })
          )
          .min(1),
        discount: z.number().nonnegative().optional(),
        dueAt: z.string().datetime({ offset: true }).optional(),
      }),
    })
  ),
  generateInvoice
);

invoiceRouter.get(
  '/',
  staffAll,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        patientId: z.string().uuid().optional(),
        status: z.enum(['PENDING', 'PAID', 'REFUNDED', 'FAILED']).optional(),
        search: z.string().max(100).optional(),
      }),
    })
  ),
  listInvoices
);

invoiceRouter.get('/:id/receipt', accountantOnly, validate(envelope.extend({ params: idParam })), generateReceipt);

invoiceRouter.get(
  '/:id',
  staffAll,
  validate(envelope.extend({ params: idParam })),
  getInvoice
);

invoiceRouter.post(
  '/:id/pay',
  accountantOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z.object({
        amount: z.number().positive(),
        method: z.string().min(2).max(100),
      }),
    })
  ),
  collectPayment
);

invoiceRouter.post(
  '/:id/refund',
  accountantOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z.object({
        amount: z.number().positive(),
      }),
    })
  ),
  processRefund
);

invoiceRouter.post(
  '/:id/claims',
  accountantOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z.object({
        provider: z.string().min(2).max(200),
        policyNumber: z.string().min(2).max(100),
        amountClaimed: z.number().positive(),
      }),
    })
  ),
  createInsuranceClaim
);

invoiceRouter.patch(
  '/:id/claims/status',
  accountantOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z.object({
        status: z.string().min(2).max(100),
      }),
    })
  ),
  updateClaimStatus
);
