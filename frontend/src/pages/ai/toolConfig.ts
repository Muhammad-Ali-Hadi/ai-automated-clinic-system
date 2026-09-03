import type { AiResult } from '../../api/ai';
import { aiApi } from '../../api/ai';
import type { Role } from '../../lib/types';

export interface ToolField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  rows?: number;
  options?: { value: string; label: string }[];
  full?: boolean;
}

export interface FormTool {
  id: string;
  title: string;
  description: string;
  group: 'Doctor tools' | 'Patient' | 'Operations';
  roles?: Role[];
  submit: (body: Record<string, string>) => Promise<AiResult>;
  fields: ToolField[];
}

export const FORM_TOOLS: FormTool[] = [
  {
    id: 'discharge-summary',
    title: 'Discharge summary',
    description: 'Draft a structured discharge summary from the encounter details.',
    group: 'Doctor tools',
    roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'],
    submit: aiApi.dischargeSummary,
    fields: [
      { name: 'patientAge', label: 'Patient age', required: true, placeholder: '54' },
      { name: 'patientGender', label: 'Patient gender', required: true, placeholder: 'Female' },
      { name: 'admissionDate', label: 'Admission date', type: 'date', required: true },
      { name: 'dischargeDate', label: 'Discharge date', type: 'date', required: true },
      { name: 'clinicalNotes', label: 'Clinical notes', type: 'textarea', rows: 5, required: true, full: true, placeholder: 'Presenting complaint, course, findings…' },
      { name: 'medications', label: 'Medications', type: 'textarea', rows: 2, full: true },
      { name: 'procedures', label: 'Procedures', type: 'textarea', rows: 2, full: true },
    ],
  },
  {
    id: 'prescription-draft',
    title: 'Prescription draft',
    description: 'Suggest a prescription for a diagnosis, checked against allergies and current meds.',
    group: 'Doctor tools',
    roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'],
    submit: aiApi.prescriptionDraft,
    fields: [
      { name: 'diagnosis', label: 'Diagnosis', required: true, full: true, placeholder: 'Community-acquired pneumonia' },
      { name: 'patientAge', label: 'Patient age', required: true },
      { name: 'patientGender', label: 'Patient gender', required: true },
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'allergies', label: 'Allergies', type: 'textarea', rows: 2, full: true, placeholder: 'Penicillin (rash)' },
      { name: 'currentMedications', label: 'Current medications', type: 'textarea', rows: 2, full: true },
    ],
  },
  {
    id: 'lab-interpretation',
    title: 'Lab interpretation',
    description: 'Explain a set of lab results in clinical context (returns structured JSON).',
    group: 'Doctor tools',
    roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LABORATORY_TECHNICIAN'],
    submit: aiApi.labInterpretation,
    fields: [
      { name: 'labResults', label: 'Lab results', type: 'textarea', rows: 6, required: true, full: true, placeholder: 'Hb 9.1 g/dL, MCV 72, Ferritin 8 ng/mL…' },
      { name: 'patientContext', label: 'Patient context', type: 'textarea', rows: 2, full: true },
    ],
  },
  {
    id: 'lab-analysis',
    title: 'Lab report analysis',
    description: 'Flag abnormal values and trends across current and historical reports.',
    group: 'Doctor tools',
    roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LABORATORY_TECHNICIAN'],
    submit: aiApi.labAnalysis,
    fields: [
      { name: 'patientAgeGender', label: 'Age / gender', placeholder: '67 / Male' },
      { name: 'currentReport', label: 'Current report', type: 'textarea', rows: 6, required: true, full: true },
      { name: 'historicalReports', label: 'Historical reports', type: 'textarea', rows: 4, full: true },
    ],
  },
  {
    id: 'patient-explainer',
    title: 'Patient explainer',
    description: 'Rewrite prescriptions or reports in plain language for a patient.',
    group: 'Patient',
    submit: aiApi.patientExplainer,
    fields: [
      { name: 'patientQuery', label: 'Patient question', type: 'textarea', rows: 3, required: true, full: true, placeholder: 'What does my blood test mean?' },
      { name: 'medicalData', label: 'Relevant medical data', type: 'textarea', rows: 4, full: true },
      { name: 'targetLanguage', label: 'Target language', placeholder: 'English' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing assistant',
    description: 'Explain an invoice, spot duplicates, or help with an insurance claim.',
    group: 'Operations',
    roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'],
    submit: aiApi.billing,
    fields: [
      {
        name: 'action',
        label: 'Task',
        type: 'select',
        options: [
          'explain_invoice',
          'summarize_balance',
          'detect_duplicates',
          'suggest_corrections',
          'insurance_claim_help',
          'generate_summary',
          'payment_reminder',
        ].map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
      },
      { name: 'invoiceData', label: 'Invoice data', type: 'textarea', rows: 6, required: true, full: true },
      { name: 'paymentHistory', label: 'Payment history', type: 'textarea', rows: 3, full: true },
    ],
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy assistant',
    description: 'Check interactions, review dosing, or forecast inventory.',
    group: 'Operations',
    roles: ['HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE'],
    submit: aiApi.pharmacy,
    fields: [
      {
        name: 'action',
        label: 'Task',
        type: 'select',
        options: [
          'check_interactions',
          'check_duplicates',
          'explain_medicine',
          'medicine_instructions',
          'inventory_replenishment',
          'inventory_forecast',
        ].map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
      },
      { name: 'medicationsList', label: 'Medications list', type: 'textarea', rows: 5, required: true, full: true, placeholder: 'Warfarin 5mg, Ibuprofen 400mg, Amoxicillin 500mg' },
      { name: 'currentInventory', label: 'Current inventory', type: 'textarea', rows: 3, full: true },
    ],
  },
  {
    id: 'document',
    title: 'Document extraction',
    description: 'Pull structured fields (diagnoses, meds, lab values) out of free-text documents.',
    group: 'Operations',
    submit: aiApi.document,
    fields: [
      { name: 'documentType', label: 'Document type', placeholder: 'referral / discharge / lab report' },
      { name: 'documentText', label: 'Document text', type: 'textarea', rows: 8, required: true, full: true },
    ],
  },
  {
    id: 'analytics',
    title: 'Operational analytics',
    description: 'Summarise metrics and surface trends, risks and recommendations.',
    group: 'Operations',
    roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT'],
    submit: aiApi.analytics,
    fields: [
      { name: 'analysisPeriod', label: 'Period', placeholder: 'last 30 days' },
      { name: 'metricsData', label: 'Metrics data', type: 'textarea', rows: 8, required: true, full: true, placeholder: 'Revenue by day, appointment counts, no-show rate…' },
    ],
  },
];
