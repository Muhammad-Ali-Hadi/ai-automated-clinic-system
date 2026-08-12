import type { RequestHandler } from 'express';
import { fileService } from '../services/file.service.js';
import { ok } from '../utils/api-response.js';

export const stageUpload: RequestHandler = async (req, res) =>
  ok(res, await fileService.stageUpload(req.auth!, req.body), 'Upload staged.', 201);

export const getFile: RequestHandler = async (req, res) =>
  ok(res, await fileService.getFile(req.auth!, String(req.params.id)), 'File retrieved.');

export const getSignedUrl: RequestHandler = async (req, res) =>
  ok(res, await fileService.getSignedUrl(req.auth!, String(req.params.id)), 'Signed URL generated.');

export const listFiles: RequestHandler = async (req, res) => {
  const result = await fileService.listFiles(req.auth!, req.query as any);
  ok(res, result.data, 'Files retrieved.', 200, result.meta);
};

export const deleteFile: RequestHandler = async (req, res) => {
  await fileService.deleteFile(req.auth!, String(req.params.id));
  ok(res, null, 'File deleted.');
};
