import type { RequestHandler } from 'express';
import { patientService } from '../services/patient.service.js';
import { consultationService } from '../services/consultation.service.js';
import { prescriptionService } from '../services/prescription.service.js';
import { medicalRecordService } from '../services/medical-record.service.js';
import { ok } from '../utils/api-response.js';
import { dischargeSummaryService } from '../services/discharge-summary.service.js';

export const createPatient: RequestHandler = async (req, res) =>
  ok(res, await patientService.create(req.auth!, req.body), 'Patient created.', 201);

export const listPatients: RequestHandler = async (req, res) => {
  const result = await patientService.list(req.auth!, req.query as never);
  ok(res, result.data, 'Patients retrieved.', 200, result.meta);
};

export const getPatient: RequestHandler = async (req, res) =>
  ok(res, await patientService.profile(req.auth!, String(req.params.patientId)), 'Patient retrieved.');

export const updatePatient: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.update(req.auth!, String(req.params.patientId), req.body),
    'Patient updated.'
  );

export const archivePatient: RequestHandler = async (req, res) => {
  await patientService.archive(req.auth!, String(req.params.patientId));
  ok(res, null, 'Patient archived.');
};

export const mergePatients: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.merge(req.auth!, String(req.params.patientId), req.body.targetPatientId),
    'Patients merged.'
  );

// Vitals
export const addVital: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.addVital(req.auth!, String(req.params.patientId), req.body),
    'Vital recorded.',
    201
  );

export const listVitals: RequestHandler = async (req, res) => {
  const result = await patientService.listVitals(
    req.auth!,
    String(req.params.patientId),
    req.query as never
  );
  ok(res, result.data, 'Vitals retrieved.', 200, result.meta);
};

// Allergies
export const addAllergy: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.addAllergy(req.auth!, String(req.params.patientId), req.body),
    'Allergy recorded.',
    201
  );

export const listAllergies: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.listAllergies(req.auth!, String(req.params.patientId)),
    'Allergies retrieved.'
  );

export const removeAllergy: RequestHandler = async (req, res) => {
  await patientService.removeAllergy(
    req.auth!,
    String(req.params.patientId),
    String(req.params.allergyId)
  );
  ok(res, null, 'Allergy removed.');
};

// Insurance
export const addInsurance: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.addInsurance(req.auth!, String(req.params.patientId), req.body),
    'Insurance recorded.',
    201
  );

export const listInsurance: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.listInsurance(req.auth!, String(req.params.patientId)),
    'Insurance records retrieved.'
  );

export const removeInsurance: RequestHandler = async (req, res) => {
  await patientService.removeInsurance(
    req.auth!,
    String(req.params.patientId),
    String(req.params.insuranceId)
  );
  ok(res, null, 'Insurance record removed.');
};

// Chronic diseases
export const addChronicDisease: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.addChronicDisease(req.auth!, String(req.params.patientId), req.body),
    'Chronic disease recorded.',
    201
  );

export const listChronicDiseases: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.listChronicDiseases(req.auth!, String(req.params.patientId)),
    'Chronic diseases retrieved.'
  );

export const removeChronicDisease: RequestHandler = async (req, res) => {
  await patientService.removeChronicDisease(
    req.auth!,
    String(req.params.patientId),
    String(req.params.diseaseId)
  );
  ok(res, null, 'Chronic disease record removed.');
};

// Emergency contacts
export const addEmergencyContact: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.addEmergencyContact(req.auth!, String(req.params.patientId), req.body),
    'Emergency contact added.',
    201
  );

export const listEmergencyContacts: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.listEmergencyContacts(req.auth!, String(req.params.patientId)),
    'Emergency contacts retrieved.'
  );

export const removeEmergencyContact: RequestHandler = async (req, res) => {
  await patientService.removeEmergencyContact(
    req.auth!,
    String(req.params.patientId),
    String(req.params.contactId)
  );
  ok(res, null, 'Emergency contact removed.');
};

// Notes
export const addPatientNote: RequestHandler = async (req, res) =>
  ok(
    res,
    await patientService.addNote(req.auth!, String(req.params.patientId), req.body.content),
    'Patient note added.',
    201
  );

export const listPatientNotes: RequestHandler = async (req, res) => {
  const result = await patientService.listNotes(
    req.auth!,
    String(req.params.patientId),
    req.query as never
  );
  ok(res, result.data, 'Patient notes retrieved.', 200, result.meta);
};

export const getPatientTimeline: RequestHandler = async (req, res) =>
  ok(res, await medicalRecordService.getTimeline(req.auth!, String(req.params.patientId)), 'Medical timeline retrieved.');

export const getPatientConsultations: RequestHandler = async (req, res) => {
  const result = await consultationService.list(req.auth!, {
    ...(req.query as any),
    patientId: String(req.params.patientId),
  });
  ok(res, result.data, 'Consultations retrieved.', 200, result.meta);
};

export const getPatientPrescriptions: RequestHandler = async (req, res) => {
  const result = await prescriptionService.list(req.auth!, {
    ...(req.query as any),
    patientId: String(req.params.patientId),
  });
  ok(res, result.data, 'Prescriptions retrieved.', 200, result.meta);
};

export const createDischargeSummary: RequestHandler = async (req, res) =>
  ok(res, await dischargeSummaryService.create(req.auth!, String(req.params.patientId), req.body), 'Discharge summary created.', 201);

export const getDischargeSummary: RequestHandler = async (req, res) =>
  ok(res, await dischargeSummaryService.getLatest(req.auth!, String(req.params.patientId)), 'Discharge summary retrieved.');
