import type { RequestHandler } from 'express';
import { inventoryService } from '../services/inventory.service.js';
import { ok } from '../utils/api-response.js';

export const createInventoryItem: RequestHandler = async (req, res) => ok(res, await inventoryService.create(req.auth!, req.body), 'Inventory item created.', 201);
export const listInventoryItems: RequestHandler = async (req, res) => {
  const result = await inventoryService.list(req.auth!, req.query as any);
  ok(res, result.data, 'Inventory items retrieved.', 200, result.meta);
};
export const updateInventoryItem: RequestHandler = async (req, res) => ok(res, await inventoryService.update(req.auth!, String(req.params.id), req.body), 'Inventory item updated.');
