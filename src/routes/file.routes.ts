import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  deleteFile,
  getFile,
  getSignedUrl,
  listFiles,
  stageUpload,
} from '../controllers/file.controller.js';

export const fileRouter = Router();
fileRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const idParam = z.object({ id: z.string().uuid() });

const staffRead = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST');
const staffWrite = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');
const adminOnly = authorize('HOSPITAL_ADMIN');

fileRouter.post(
  '/upload',
  staffWrite,
  validate(
    envelope.extend({
      body: z.object({
        originalName: z.string().min(1).max(300),
        mimeType: z.string().min(3).max(100),
        sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
        patientId: z.string().uuid().optional(),
        labTestId: z.string().uuid().optional(),
        category: z.enum(['LAB_RESULT', 'RADIOLOGY_REPORT', 'PRESCRIPTION', 'PATIENT_DOCUMENT', 'PROFILE_IMAGE']).optional(),
      }),
    })
  ),
  stageUpload
);

fileRouter.get(
  '/',
  staffRead,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        patientId: z.string().uuid().optional(),
        labTestId: z.string().uuid().optional(),
        category: z.enum(['LAB_RESULT', 'RADIOLOGY_REPORT', 'PRESCRIPTION', 'PATIENT_DOCUMENT', 'PROFILE_IMAGE']).optional(),
        mimeType: z.string().max(100).optional(),
      }),
    })
  ),
  listFiles
);

fileRouter.get(
  '/:id',
  staffRead,
  validate(envelope.extend({ params: idParam })),
  getFile
);

fileRouter.get(
  '/:id/url',
  staffRead,
  validate(envelope.extend({ params: idParam })),
  getSignedUrl
);

fileRouter.delete(
  '/:id',
  adminOnly,
  validate(envelope.extend({ params: idParam })),
  deleteFile
);
