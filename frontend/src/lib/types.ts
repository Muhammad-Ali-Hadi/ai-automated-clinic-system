export type Role =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'RECEPTIONIST'
  | 'NURSE'
  | 'PHARMACIST'
  | 'LABORATORY_TECHNICIAN'
  | 'ACCOUNTANT'
  | 'PATIENT';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  hospitalId: string | null;
  firstName?: string;
  lastName?: string;
}

export interface Patient {
  id: string;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string | null;
  email?: string | null;
  status?: string;
  createdAt?: string;
}

export interface Doctor {
  id: string;
  userId: string;
  specialization: string;
  licenseNumber: string;
  consultationFee?: number | string | null;
  user?: { id: string; firstName?: string; lastName?: string; email?: string };
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  status: string;
  reason?: string | null;
  patient?: Patient;
  doctor?: Doctor;
  queueEntry?: { id: string; queueNumber: number; status: string } | null;
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  clinicalNotes: string;
  diagnosis?: string | null;
  treatmentPlan?: string | null;
  followUpAt?: string | null;
  createdAt?: string;
  patient?: Patient;
}

export interface Prescription {
  id: string;
  patientId: string;
  consultationId?: string | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string | null;
  status?: string;
  createdAt?: string;
  patient?: Patient;
}

export interface LabTest {
  id: string;
  patientId: string;
  testName: string;
  status: string;
  result?: string | null;
  referenceRange?: string | null;
  createdAt?: string;
  patient?: Patient;
}

export interface Medicine {
  id: string;
  name: string;
  category?: string | null;
  sku: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number | string;
  expiresAt?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  status: string;
  subtotal?: number | string;
  discount?: number | string;
  total: number | string;
  amountPaid?: number | string;
  dueAt?: string | null;
  createdAt?: string;
  patient?: Patient;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number | string;
  total?: number | string;
}

export interface Employee {
  id: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  salary?: number | string | null;
  status?: string;
}

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactInfo?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type?: string;
  quantity: number;
  reorderLevel?: number;
  status?: string;
  unit?: string | null;
}

export interface NotificationRow {
  id: string;
  channel: string;
  recipient?: string;
  subject?: string | null;
  body?: string | null;
  status: string;
  readAt?: string | null;
  createdAt?: string;
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  userId?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}
