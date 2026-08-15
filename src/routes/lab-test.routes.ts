import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  cancelLabRequest,
  approveLabResult,
  collectSample,
  createLabRequest,
  generateLabReport,
  getLabRequest,
  listLabRequests,
  recordResult,
  rejectLabResult,
  trackSample,
} from '../controllers/lab-test.controller.js';

export const labTestRouter = Router();
labTestRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const idParam = z.object({ id: z.string().uuid() });

const staffWrite = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE');
const labStaff = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'LABORATORY_TECHNICIAN');
const staffRead = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LABORATORY_TECHNICIAN', 'RECEPTIONIST');

labTestRouter.post(
  '/',
  staffWrite,
  validate(
    envelope.extend({
      body: z.object({
        patientId: z.string().uuid(),
        testName: z.string().min(2).max(200),
        referenceRange: z.string().max(200).optional(),
      }),
    })
  ),
  createLabRequest
);

labTestRouter.get(
  '/',
  staffRead,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        patientId: z.string().uuid().optional(),
        status: z.enum(['REQUESTED', 'COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
        search: z.string().max(100).optional(),
      }),
    })
  ),
  listLabRequests
);

labTestRouter.get(
  '/:id',
  staffRead,
  validate(envelope.extend({ params: idParam })),
  getLabRequest
);

labTestRouter.post(
  '/:id/collect',
  labStaff,
  validate(envelope.extend({ params: idParam })),
  collectSample
);

labTestRouter.post(
  '/:id/process',
  labStaff,
  validate(envelope.extend({ params: idParam })),
  trackSample
);

labTestRouter.post(
  '/:id/result',
  labStaff,
  validate(
    envelope.extend({
      params: idParam,
      body: z.object({
        result: z.string().min(1),
        referenceRange: z.string().max(200).optional(),
      }),
    })
  ),
  recordResult
);

labTestRouter.post(
  '/:id/reject',
  labStaff,
  validate(envelope.extend({ params: idParam, body: z.object({ reason: z.string().trim().min(3).max(2000) }) })),
  rejectLabResult
);

labTestRouter.post(
  '/:id/approve',
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  validate(envelope.extend({ params: idParam })),
  approveLabResult
);
labTestRouter.post(
  '/:id/cancel',
  staffWrite,
  validate(envelope.extend({ params: idParam })),
  cancelLabRequest
);

labTestRouter.get(
  '/:id/report',
  staffRead,
  validate(envelope.extend({ params: idParam })),
  generateLabReport
);
