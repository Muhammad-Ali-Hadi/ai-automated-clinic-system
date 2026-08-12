import swaggerJsdoc from 'swagger-jsdoc';

export const openapi = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Renovia Hospital OS API', version: '2.0.0' },
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: { type: 'array', items: {} },
            statusCode: { type: 'integer' },
          },
        },
        Patient: {
          type: 'object',
          required: ['medicalRecordNumber', 'firstName', 'lastName', 'dateOfBirth'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            medicalRecordNumber: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            dateOfBirth: { type: 'string', format: 'date' },
          },
        },
      },
    },
    paths: {
      // Auth
      '/api/v1/auth/login': {
        post: {
          security: [],
          summary: 'Authenticate a user',
          responses: {
            200: { description: 'Login successful' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      // Hospitals
      '/api/v1/hospitals/me': {
        get: {
          summary: 'Get hospital profile',
          responses: { 200: { description: 'Profile retrieved' } },
        },
        patch: {
          summary: 'Update hospital profile',
          responses: { 200: { description: 'Profile updated' } },
        },
      },
      '/api/v1/hospitals/me/settings': {
        put: {
          summary: 'Update hospital settings',
          responses: { 200: { description: 'Settings updated' } },
        },
      },
      '/api/v1/hospitals/branches': {
        get: {
          summary: 'List branches',
          responses: { 200: { description: 'Branches retrieved' } },
        },
        post: {
          summary: 'Create branch',
          responses: { 201: { description: 'Branch created' } },
        },
      },
      '/api/v1/hospitals/branches/{branchId}': {
        patch: {
          summary: 'Update branch',
          parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Branch updated' } },
        },
        delete: {
          summary: 'Delete branch',
          parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Branch deleted' } },
        },
      },
      '/api/v1/hospitals/branches/{branchId}/working-hours': {
        put: {
          summary: 'Replace working hours for a branch',
          parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Working hours updated' } },
        },
      },
      // Patients
      '/api/v1/patients': {
        get: {
          summary: 'List tenant patients',
          responses: { 200: { description: 'Patients retrieved' } },
        },
        post: {
          summary: 'Register a tenant patient',
          responses: { 201: { description: 'Patient created' } },
        },
      },
      '/api/v1/patients/{patientId}': {
        get: {
          summary: 'Get patient profile',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Patient retrieved' } },
        },
        patch: {
          summary: 'Update patient profile',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Patient updated' } },
        },
      },
      '/api/v1/patients/{patientId}/archive': {
        post: {
          summary: 'Archive patient',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Patient archived' } },
        },
      },
      '/api/v1/patients/{patientId}/merge': {
        post: {
          summary: 'Merge patients',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Patients merged' } },
        },
      },
      '/api/v1/patients/{patientId}/timeline': {
        get: {
          summary: 'Get patient medical timeline',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Medical timeline retrieved' } },
        },
      },
      '/api/v1/patients/{patientId}/consultations': {
        get: {
          summary: 'List consultations for patient',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Consultations retrieved' } },
        },
      },
      '/api/v1/patients/{patientId}/prescriptions': {
        get: {
          summary: 'List prescriptions for patient',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Prescriptions retrieved' } },
        },
      },
      '/api/v1/patients/{patientId}/vitals': {
        get: {
          summary: 'List patient vitals',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Vitals retrieved' } },
        },
        post: {
          summary: 'Record patient vitals',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 201: { description: 'Vitals recorded' } },
        },
      },
      '/api/v1/patients/{patientId}/allergies': {
        get: {
          summary: 'List patient allergies',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Allergies retrieved' } },
        },
        post: {
          summary: 'Record patient allergy',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 201: { description: 'Allergy recorded' } },
        },
      },
      '/api/v1/patients/{patientId}/allergies/{allergyId}': {
        delete: {
          summary: 'Remove patient allergy',
          parameters: [
            { name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'allergyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Allergy removed' } },
        },
      },
      '/api/v1/patients/{patientId}/insurance': {
        get: {
          summary: 'List patient insurance records',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Insurance records retrieved' } },
        },
        post: {
          summary: 'Record patient insurance',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 201: { description: 'Insurance recorded' } },
        },
      },
      '/api/v1/patients/{patientId}/insurance/{insuranceId}': {
        delete: {
          summary: 'Remove patient insurance',
          parameters: [
            { name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'insuranceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Insurance record removed' } },
        },
      },
      '/api/v1/patients/{patientId}/chronic-diseases': {
        get: {
          summary: 'List patient chronic diseases',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Chronic diseases retrieved' } },
        },
        post: {
          summary: 'Record patient chronic disease',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 201: { description: 'Chronic disease recorded' } },
        },
      },
      '/api/v1/patients/{patientId}/chronic-diseases/{diseaseId}': {
        delete: {
          summary: 'Remove patient chronic disease',
          parameters: [
            { name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'diseaseId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Chronic disease record removed' } },
        },
      },
      '/api/v1/patients/{patientId}/emergency-contacts': {
        get: {
          summary: 'List patient emergency contacts',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Emergency contacts retrieved' } },
        },
        post: {
          summary: 'Add emergency contact',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 201: { description: 'Emergency contact added' } },
        },
      },
      '/api/v1/patients/{patientId}/emergency-contacts/{contactId}': {
        delete: {
          summary: 'Remove emergency contact',
          parameters: [
            { name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'contactId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Emergency contact removed' } },
        },
      },
      '/api/v1/patients/{patientId}/notes': {
        get: {
          summary: 'List patient notes',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Patient notes retrieved' } },
        },
        post: {
          summary: 'Add patient note',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 201: { description: 'Patient note added' } },
        },
      },
      // Doctors
      '/api/v1/doctors': {
        get: {
          summary: 'List doctors',
          responses: { 200: { description: 'Doctors retrieved' } },
        },
        post: {
          summary: 'Create doctor profile',
          responses: { 201: { description: 'Doctor profile created' } },
        },
      },
      '/api/v1/doctors/{doctorId}': {
        get: {
          summary: 'Get doctor profile',
          parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Doctor profile retrieved' } },
        },
        patch: {
          summary: 'Update doctor profile',
          parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Doctor profile updated' } },
        },
      },
      '/api/v1/doctors/{doctorId}/availability': {
        get: {
          summary: 'Get doctor availability',
          parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Availability retrieved' } },
        },
        put: {
          summary: 'Replace doctor availability',
          parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Availability updated' } },
        },
      },
      // Departments
      '/api/v1/departments': {
        get: { summary: 'List departments', responses: { 200: { description: 'Departments retrieved' } } },
        post: { summary: 'Create department', responses: { 201: { description: 'Department created' } } },
      },
      // Appointments
      '/api/v1/appointments': {
        get: { summary: 'List appointments', responses: { 200: { description: 'Appointments retrieved' } } },
        post: { summary: 'Book appointment', responses: { 201: { description: 'Appointment booked' } } },
      },
      '/api/v1/appointments/queue': {
        get: { summary: 'Get queue', responses: { 200: { description: 'Queue retrieved' } } },
      },
      '/api/v1/appointments/walk-in': {
        post: { summary: 'Walk-in registration', responses: { 201: { description: 'Walk-in checked in' } } },
      },
      '/api/v1/appointments/recurring': {
        post: { summary: 'Book recurring appointments', responses: { 201: { description: 'Recurring appointments booked' } } },
      },
      '/api/v1/appointments/{appointmentId}': {
        get: {
          summary: 'Get appointment details',
          parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Appointment details retrieved' } },
        },
      },
      '/api/v1/appointments/{appointmentId}/status': {
        patch: {
          summary: 'Update appointment status',
          parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Status updated' } },
        },
      },
      '/api/v1/appointments/{appointmentId}/reschedule': {
        post: {
          summary: 'Reschedule appointment',
          parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Rescheduled successfully' } },
        },
      },
      '/api/v1/appointments/{appointmentId}/cancel': {
        post: {
          summary: 'Cancel appointment',
          parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Cancelled successfully' } },
        },
      },
      '/api/v1/appointments/{appointmentId}/check-in': {
        post: {
          summary: 'Check-in appointment',
          parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Checked in successfully' } },
        },
      },
      '/api/v1/appointments/{appointmentId}/check-out': {
        post: {
          summary: 'Check-out appointment',
          parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Checked out successfully' } },
        },
      },
      // Medical Records
      '/api/v1/medical-records': {
        post: { summary: 'Create medical record', responses: { 201: { description: 'Medical record created' } } },
      },
      '/api/v1/medical-records/patient/{patientId}': {
        get: {
          summary: 'List patient medical records',
          parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Medical records retrieved' } },
        },
      },
      '/api/v1/medical-records/{recordId}': {
        get: {
          summary: 'Get medical record by ID',
          parameters: [{ name: 'recordId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Medical record retrieved' } },
        },
        patch: {
          summary: 'Update medical record',
          parameters: [{ name: 'recordId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Medical record updated' } },
        },
      },
      // Consultations
      '/api/v1/consultations': {
        get: { summary: 'List consultations', responses: { 200: { description: 'Consultations retrieved' } } },
        post: { summary: 'Create consultation', responses: { 201: { description: 'Consultation created' } } },
      },
      '/api/v1/consultations/{consultationId}': {
        get: {
          summary: 'Get consultation details',
          parameters: [{ name: 'consultationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Consultation details retrieved' } },
        },
        patch: {
          summary: 'Update consultation details',
          parameters: [{ name: 'consultationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Consultation updated' } },
        },
      },
      // Prescriptions
      '/api/v1/prescriptions': {
        get: { summary: 'List prescriptions', responses: { 200: { description: 'Prescriptions retrieved' } } },
        post: { summary: 'Create prescription', responses: { 201: { description: 'Prescription created' } } },
      },
      '/api/v1/prescriptions/{prescriptionId}': {
        get: {
          summary: 'Get prescription details',
          parameters: [{ name: 'prescriptionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Prescription details retrieved' } },
        },
      },
      // Batch 2 Modules
      '/api/v1/lab-tests': {
        get: { summary: 'List lab tests', responses: { 200: { description: 'Lab tests retrieved' } } },
        post: { summary: 'Request lab test', responses: { 201: { description: 'Lab test requested' } } },
      },
      '/api/v1/medicines': {
        get: { summary: 'List medicines', responses: { 200: { description: 'Medicines retrieved' } } },
        post: { summary: 'Create medicine', responses: { 201: { description: 'Medicine created' } } },
      },
      '/api/v1/invoices': {
        get: { summary: 'List invoices', responses: { 200: { description: 'Invoices retrieved' } } },
        post: { summary: 'Generate invoice', responses: { 201: { description: 'Invoice generated' } } },
      },
      '/api/v1/employees': {
        get: { summary: 'List employees', responses: { 200: { description: 'Employees retrieved' } } },
        post: { summary: 'Create employee', responses: { 201: { description: 'Employee created' } } },
      },
      '/api/v1/notifications': {
        get: { summary: 'List notifications', responses: { 200: { description: 'Notifications retrieved' } } },
        post: { summary: 'Send notification', responses: { 201: { description: 'Notification sent' } } },
      },
      '/api/v1/reports/dashboard': {
        get: { summary: 'Get dashboard summary', responses: { 200: { description: 'Dashboard retrieved' } } },
      },
      '/api/v1/appointments/calendar': { get: { summary: 'Calendar appointments', responses: { 200: { description: 'Calendar retrieved' } } } },
      '/api/v1/patients/{patientId}/discharge-summary': {
        get: { summary: 'Retrieve discharge summary', responses: { 200: { description: 'Discharge summary retrieved' } } },
        post: { summary: 'Create discharge summary', responses: { 201: { description: 'Discharge summary created' } } },
      },
      '/api/v1/lab-tests/{id}/reject': { post: { summary: 'Reject laboratory result', responses: { 200: { description: 'Result rejected' } } } },
      '/api/v1/lab-tests/{id}/approve': { post: { summary: 'Approve laboratory result', responses: { 200: { description: 'Result approved' } } } },
      '/api/v1/lab-tests/{id}/report': { get: { summary: 'Generate laboratory report', responses: { 200: { description: 'Report generated' } } } },
      '/api/v1/reports/exports': { get: { summary: 'Export report as PDF or Excel', parameters: [{ name: 'report', in: 'query', required: true, schema: { type: 'string' } }, { name: 'format', in: 'query', required: true, schema: { type: 'string', enum: ['pdf', 'excel'] } }], responses: { 200: { description: 'Report file' } } } },
      '/api/v1/inventory': { get: { summary: 'List inventory', responses: { 200: { description: 'Inventory retrieved' } } }, post: { summary: 'Create inventory item', responses: { 201: { description: 'Inventory item created' } } } },
      '/api/v1/payroll-integrations': { get: { summary: 'List payroll integrations', responses: { 200: { description: 'Integrations retrieved' } } }, post: { summary: 'Configure payroll integration', responses: { 201: { description: 'Integration configured' } } } },
      '/api/v1/reminders': { get: { summary: 'List reminders', responses: { 200: { description: 'Reminders retrieved' } } }, post: { summary: 'Schedule reminder', responses: { 201: { description: 'Reminder scheduled' } } } },      '/api/v1/files': {
        get: { summary: 'List files', responses: { 200: { description: 'Files retrieved' } } },
      },
      '/api/v1/files/upload': {
        post: { summary: 'Stage file upload', responses: { 201: { description: 'Upload staged' } } },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});
