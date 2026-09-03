/** Central query-key registry — one place so invalidation stays consistent. */
export const qk = {
  profile: ['profile'] as const,

  patients: (params?: unknown) => ['patients', params ?? {}] as const,
  patient: (id: string) => ['patient', id] as const,
  patientSub: (id: string, sub: string) => ['patient', id, sub] as const,

  doctors: (params?: unknown) => ['doctors', params ?? {}] as const,
  doctor: (id: string) => ['doctor', id] as const,

  departments: (params?: unknown) => ['departments', params ?? {}] as const,

  appointments: (params?: unknown) => ['appointments', params ?? {}] as const,
  appointment: (id: string) => ['appointment', id] as const,
  queue: (date?: string) => ['queue', date ?? 'today'] as const,

  consultations: (params?: unknown) => ['consultations', params ?? {}] as const,
  prescriptions: (params?: unknown) => ['prescriptions', params ?? {}] as const,

  labTests: (params?: unknown) => ['labTests', params ?? {}] as const,
  labTest: (id: string) => ['labTest', id] as const,

  medicines: (params?: unknown) => ['medicines', params ?? {}] as const,
  dispensing: (params?: unknown) => ['dispensing', params ?? {}] as const,

  invoices: (params?: unknown) => ['invoices', params ?? {}] as const,
  invoice: (id: string) => ['invoice', id] as const,

  employees: (params?: unknown) => ['employees', params ?? {}] as const,
  suppliers: ['suppliers'] as const,
  inventory: (params?: unknown) => ['inventory', params ?? {}] as const,
  notifications: (params?: unknown) => ['notifications', params ?? {}] as const,
  users: (params?: unknown) => ['users', params ?? {}] as const,
  auditLogs: (params?: unknown) => ['auditLogs', params ?? {}] as const,

  reportDashboard: ['report', 'dashboard'] as const,
  report: (name: string, params?: unknown) => ['report', name, params ?? {}] as const,
};
