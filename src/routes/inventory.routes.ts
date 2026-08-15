import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createInventoryItem, listInventoryItems, updateInventoryItem } from '../controllers/inventory.controller.js';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate, requireTenant);
const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const admin = authorize('HOSPITAL_ADMIN');
const read = authorize('HOSPITAL_ADMIN', 'PHARMACIST', 'NURSE', 'ACCOUNTANT');
const id = z.object({ id: z.string().uuid() });

inventoryRouter.post('/', admin, validate(envelope.extend({ body: z.object({ name: z.string().min(2).max(200), type: z.enum(['EQUIPMENT', 'CONSUMABLE']), category: z.string().max(100).optional(), quantity: z.number().int().nonnegative().default(0), reorderLevel: z.number().int().nonnegative().default(0), unitCost: z.number().nonnegative().optional(), location: z.string().max(200).optional(), supplierName: z.string().max(200).optional() }) })), createInventoryItem);
inventoryRouter.get('/', read, validate(envelope.extend({ query: z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20), type: z.enum(['EQUIPMENT', 'CONSUMABLE']).optional(), lowStockOnly: z.coerce.boolean().optional(), search: z.string().max(100).optional() }) })), listInventoryItems);
inventoryRouter.patch('/:id', admin, validate(envelope.extend({ params: id, body: z.object({ name: z.string().min(2).max(200).optional(), quantity: z.number().int().nonnegative().optional(), reorderLevel: z.number().int().nonnegative().optional(), location: z.string().max(200).optional(), status: z.enum(['ACTIVE', 'RETIRED']).optional(), supplierName: z.string().max(200).optional() }).refine((value) => Object.keys(value).length > 0, 'At least one field to update') })), updateInventoryItem);
