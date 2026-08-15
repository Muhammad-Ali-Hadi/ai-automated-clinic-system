import type { RequestHandler } from 'express';
import { doctorService } from '../services/doctor.service.js';
import { ok } from '../utils/api-response.js';

export const createDoctorProfile: RequestHandler = async (req, res) =>
  ok(res, await doctorService.createProfile(req.auth!, req.body), 'Doctor profile created.', 201);

export const getDoctorProfile: RequestHandler = async (req, res) =>
  ok(
    res,
    await doctorService.getProfile(req.auth!, String(req.params.doctorId)),
    'Doctor profile retrieved.'
  );

export const updateDoctorProfile: RequestHandler = async (req, res) =>
  ok(
    res,
    await doctorService.updateProfile(req.auth!, String(req.params.doctorId), req.body),
    'Doctor profile updated.'
  );

export const listDoctors: RequestHandler = async (req, res) => {
  const result = await doctorService.listDoctors(req.auth!, req.query as never);
  ok(res, result.data, 'Doctors retrieved.', 200, result.meta);
};

export const setAvailability: RequestHandler = async (req, res) =>
  ok(
    res,
    await doctorService.setAvailability(req.auth!, String(req.params.doctorId), req.body.slots),
    'Availability updated.'
  );

export const getAvailability: RequestHandler = async (req, res) =>
  ok(
    res,
    await doctorService.getAvailability(req.auth!, String(req.params.doctorId)),
    'Availability retrieved.'
  );

export const listDoctorConsultations: RequestHandler = async (req, res) => {
  const result = await doctorService.listConsultations(
    req.auth!,
    String(req.params.doctorId),
    req.query as never
  );
  ok(res, result.data, 'Consultations retrieved.', 200, result.meta);
};
