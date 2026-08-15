import { reportExportService } from '../services/report-export.service.js';
import type { RequestHandler } from 'express';
import { reportService } from '../services/report.service.js';
import { ok } from '../utils/api-response.js';

export const getDashboard: RequestHandler = async (req, res) =>
  ok(res, await reportService.getDashboardSummary(req.auth!), 'Dashboard summary retrieved.');

export const getRevenueReport: RequestHandler = async (req, res) =>
  ok(res, await reportService.getRevenueReport(req.auth!, req.query as any), 'Revenue report retrieved.');

export const getAppointmentAnalytics: RequestHandler = async (req, res) =>
  ok(res, await reportService.getAppointmentAnalytics(req.auth!, req.query as any), 'Appointment analytics retrieved.');

export const getPatientGrowth: RequestHandler = async (req, res) =>
  ok(res, await reportService.getPatientGrowthReport(req.auth!, req.query as any), 'Patient growth report retrieved.');

export const getDoctorPerformance: RequestHandler = async (req, res) =>
  ok(res, await reportService.getDoctorPerformance(req.auth!, req.query as any), 'Doctor performance report retrieved.');

export const getLabReport: RequestHandler = async (req, res) =>
  ok(res, await reportService.getLabReport(req.auth!, req.query as any), 'Laboratory report retrieved.');

export const getPharmacyReport: RequestHandler = async (req, res) =>
  ok(res, await reportService.getPharmacyReport(req.auth!), 'Pharmacy/inventory report retrieved.');

export const exportReport: RequestHandler = async (req, res) => {
  const result = await reportExportService.build(req.auth!, req.query as any);
  res.setHeader('Content-Type', result.type);
  res.setHeader('Content-Disposition', 'attachment; filename=' + result.name);
  res.status(200).send(result.body);
};
