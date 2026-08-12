import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  addPerformanceNote,
  approveLeave,
  assignShift,
  checkIn,
  checkOut,
  createEmployee,
  createShift,
  deleteEmployee,
  getAttendanceHistory,
  getEmployee,
  leaveHistory,
  listEmployees,
  listPerformanceNotes,
  listShifts,
  rejectLeave,
  requestLeave,
  updateEmployee,
} from '../controllers/employee.controller.js';

export const employeeRouter = Router();
employeeRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const idParam = z.object({ id: z.string().uuid() });
const empParam = z.object({ employeeId: z.string().uuid() });

const hrOnly = authorize('HOSPITAL_ADMIN');
const hrRead = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE');

// Employee CRUD
employeeRouter.post(
  '/',
  hrOnly,
  validate(
    envelope.extend({
      body: z.object({
        userId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        designation: z.string().min(2).max(200),
        joinedAt: z.string().datetime({ offset: true }),
      }),
    })
  ),
  createEmployee
);

employeeRouter.get(
  '/',
  hrRead,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        departmentId: z.string().uuid().optional(),
        designation: z.string().max(200).optional(),
        search: z.string().max(100).optional(),
      }),
    })
  ),
  listEmployees
);

employeeRouter.get(
  '/:id',
  hrRead,
  validate(envelope.extend({ params: idParam })),
  getEmployee
);

employeeRouter.patch(
  '/:id',
  hrOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z
        .object({
          departmentId: z.string().uuid().nullable().optional(),
          designation: z.string().min(2).max(200).optional(),
          joinedAt: z.string().datetime({ offset: true }).optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field to update'),
    })
  ),
  updateEmployee
);

employeeRouter.delete(
  '/:id',
  hrOnly,
  validate(envelope.extend({ params: idParam })),
  deleteEmployee
);

// Attendance
employeeRouter.post(
  '/:employeeId/attendance/check-in',
  hrRead,
  validate(envelope.extend({ params: empParam })),
  checkIn
);

employeeRouter.post(
  '/:employeeId/attendance/check-out',
  hrRead,
  validate(envelope.extend({ params: empParam })),
  checkOut
);

employeeRouter.get(
  '/:employeeId/attendance',
  hrRead,
  validate(
    envelope.extend({
      params: empParam,
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      }),
    })
  ),
  getAttendanceHistory
);

// Shifts
employeeRouter.post(
  '/shifts',
  hrOnly,
  validate(
    envelope.extend({
      body: z.object({
        name: z.string().min(2).max(100),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        days: z.array(z.number().int().min(0).max(6)).min(1),
      }),
    })
  ),
  createShift
);

employeeRouter.get('/shifts/list', hrRead, listShifts);

employeeRouter.post(
  '/:employeeId/shifts/assign',
  hrOnly,
  validate(
    envelope.extend({
      params: empParam,
      body: z.object({ shiftId: z.string().uuid() }),
    })
  ),
  assignShift
);

// Leave
employeeRouter.post(
  '/:employeeId/leave',
  hrRead,
  validate(
    envelope.extend({
      params: empParam,
      body: z.object({
        type: z.string().min(2).max(100),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().min(5).max(1000),
      }),
    })
  ),
  requestLeave
);

employeeRouter.get(
  '/:employeeId/leave',
  hrRead,
  validate(envelope.extend({ params: empParam })),
  leaveHistory
);

employeeRouter.post(
  '/:employeeId/leave/:leaveId/approve',
  hrOnly,
  validate(envelope.extend({ params: empParam.extend({ leaveId: z.string().uuid() }) })),
  approveLeave
);

employeeRouter.post(
  '/:employeeId/leave/:leaveId/reject',
  hrOnly,
  validate(envelope.extend({ params: empParam.extend({ leaveId: z.string().uuid() }) })),
  rejectLeave
);

// Performance Notes
employeeRouter.post(
  '/:employeeId/performance-notes',
  hrOnly,
  validate(
    envelope.extend({
      params: empParam,
      body: z.object({
        note: z.string().min(10).max(2000),
        rating: z.number().int().min(1).max(5).optional(),
      }),
    })
  ),
  addPerformanceNote
);

employeeRouter.get(
  '/:employeeId/performance-notes',
  hrOnly,
  validate(envelope.extend({ params: empParam })),
  listPerformanceNotes
);
