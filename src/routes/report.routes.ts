import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  getAppointmentAnalytics,
  getDashboard,
  getDoctorPerformance,
  getLabReport,
  getPatientGrowth,
  getPharmacyReport,
  exportReport,
  getRevenueReport,
} from '../controllers/report.controller.js';

export const reportRouter = Router();
reportRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });

const adminOnly = authorize('HOSPITAL_ADMIN');
const financialAccess = authorize('HOSPITAL_ADMIN', 'ACCOUNTANT');
const staffRead = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'ACCOUNTANT');

const dateRangeQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  groupBy: z.enum(['day', 'month']).optional(),
});

reportRouter.get('/dashboard', adminOnly, getDashboard);
reportRouter.get('/exports', financialAccess, validate(envelope.extend({ query: dateRangeQuery.extend({ report: z.enum(['revenue', 'appointments', 'laboratory', 'pharmacy']), format: z.enum(['pdf', 'excel']) }) })), exportReport);

reportRouter.get(
  '/revenue',
  financialAccess,
  validate(envelope.extend({ query: dateRangeQuery })),
  getRevenueReport
);

reportRouter.get(
  '/appointments',
  staffRead,
  validate(
    envelope.extend({
      query: dateRangeQuery.extend({ doctorId: z.string().uuid().optional() }),
    })
  ),
  getAppointmentAnalytics
);

reportRouter.get(
  '/patients',
  adminOnly,
  validate(envelope.extend({ query: dateRangeQuery })),
  getPatientGrowth
);

reportRouter.get(
  '/doctors',
  adminOnly,
  validate(envelope.extend({ query: dateRangeQuery.omit({ groupBy: true }) })),
  getDoctorPerformance
);

reportRouter.get(
  '/laboratory',
  staffRead,
  validate(envelope.extend({ query: dateRangeQuery.omit({ groupBy: true }) })),
  getLabReport
);

reportRouter.get('/pharmacy', adminOnly, getPharmacyReport);
