import type { RequestHandler } from 'express';
import { employeeService } from '../services/employee.service.js';
import { ok } from '../utils/api-response.js';

export const createEmployee: RequestHandler = async (req, res) =>
  ok(res, await employeeService.createEmployee(req.auth!, req.body), 'Employee created.', 201);

export const getEmployee: RequestHandler = async (req, res) =>
  ok(res, await employeeService.getEmployee(req.auth!, String(req.params.id)), 'Employee retrieved.');

export const updateEmployee: RequestHandler = async (req, res) =>
  ok(res, await employeeService.updateEmployee(req.auth!, String(req.params.id), req.body), 'Employee updated.');

export const deleteEmployee: RequestHandler = async (req, res) => {
  await employeeService.deleteEmployee(req.auth!, String(req.params.id));
  ok(res, null, 'Employee deleted.');
};

export const listEmployees: RequestHandler = async (req, res) => {
  const result = await employeeService.listEmployees(req.auth!, req.query as any);
  ok(res, result.data, 'Employees retrieved.', 200, result.meta);
};

export const checkIn: RequestHandler = async (req, res) =>
  ok(res, await employeeService.checkIn(req.auth!, String(req.params.employeeId)), 'Checked in.');

export const checkOut: RequestHandler = async (req, res) =>
  ok(res, await employeeService.checkOut(req.auth!, String(req.params.employeeId)), 'Checked out.');

export const getAttendanceHistory: RequestHandler = async (req, res) => {
  const result = await employeeService.getAttendanceHistory(req.auth!, String(req.params.employeeId), req.query as any);
  ok(res, result.data, 'Attendance history retrieved.', 200, result.meta);
};

export const createShift: RequestHandler = async (req, res) =>
  ok(res, await employeeService.createShift(req.auth!, req.body), 'Shift created.', 201);

export const listShifts: RequestHandler = async (req, res) =>
  ok(res, await employeeService.listShifts(req.auth!), 'Shifts retrieved.');

export const assignShift: RequestHandler = async (req, res) =>
  ok(res, await employeeService.assignShift(req.auth!, String(req.params.employeeId), req.body.shiftId), 'Shift assigned.');

export const requestLeave: RequestHandler = async (req, res) =>
  ok(res, await employeeService.requestLeave(req.auth!, String(req.params.employeeId), req.body), 'Leave request submitted.', 201);

export const approveLeave: RequestHandler = async (req, res) =>
  ok(res, await employeeService.approveLeave(req.auth!, String(req.params.employeeId), String(req.params.leaveId)), 'Leave approved.');

export const rejectLeave: RequestHandler = async (req, res) =>
  ok(res, await employeeService.rejectLeave(req.auth!, String(req.params.employeeId), String(req.params.leaveId)), 'Leave rejected.');

export const leaveHistory: RequestHandler = async (req, res) =>
  ok(res, await employeeService.leaveHistory(req.auth!, String(req.params.employeeId)), 'Leave history retrieved.');

export const addPerformanceNote: RequestHandler = async (req, res) =>
  ok(res, await employeeService.addPerformanceNote(req.auth!, String(req.params.employeeId), req.body), 'Performance note added.', 201);

export const listPerformanceNotes: RequestHandler = async (req, res) =>
  ok(res, await employeeService.listPerformanceNotes(req.auth!, String(req.params.employeeId)), 'Performance notes retrieved.');
