import swaggerJsdoc from 'swagger-jsdoc';
import { routeOperations } from './route-manifest.js';

const mutationMethods = new Set(['post', 'put', 'patch']);

const generatedOpenapi = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Renovia Hospital OS API', version: '2.0.0' },
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@example.com' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'your-password' },
          },
        },
        RegisterHospitalRequest: {
          type: 'object', required: ['hospitalName', 'email', 'password', 'firstName', 'lastName'],
          properties: {
            hospitalName: { type: 'string', minLength: 2, maxLength: 200, example: 'Demo Hospital' },
            email: { type: 'string', format: 'email', example: 'admin@example.com' },
            password: { type: 'string', format: 'password', minLength: 8, maxLength: 128, example: 'StrongPassword123!' },
            firstName: { type: 'string', minLength: 1, maxLength: 100, example: 'Hospital' },
            lastName: { type: 'string', minLength: 1, maxLength: 100, example: 'Admin' },
          },
        },
        ChangePasswordRequest: {
          type: 'object', required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', format: 'password', minLength: 8 },
            newPassword: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
          },
        },
        HospitalUpdateRequest: {
          type: 'object', minProperties: 1,
          properties: { name: { type: 'string', minLength: 2, maxLength: 200 }, isActive: { type: 'boolean' } },
        },
        HospitalSettingsRequest: {
          type: 'object',
          properties: {
            preferences: { type: 'object', additionalProperties: true },
            configuration: { type: 'object', additionalProperties: true },
            subscriptionPlan: { type: 'string' },
            subscriptionEndsAt: { type: 'string', format: 'date-time', nullable: true },
            logoKey: { type: 'string', nullable: true },
          },
        },
        BranchCreateRequest: {
          type: 'object', required: ['name'],
          properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, address: { type: 'string', maxLength: 500 }, phone: { type: 'string', maxLength: 30 } },
        },
        BranchUpdateRequest: {
          type: 'object', minProperties: 1,
          properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, address: { type: 'string', maxLength: 500 }, phone: { type: 'string', maxLength: 30 }, isActive: { type: 'boolean' } },
        },
        WorkingHoursRequest: {
          type: 'object', required: ['hours'],
          properties: { hours: { type: 'array', minItems: 1, maxItems: 7, items: { type: 'object', required: ['weekday', 'opensAt', 'closesAt'], properties: { weekday: { type: 'integer', minimum: 0, maximum: 6 }, opensAt: { type: 'string', example: '09:00' }, closesAt: { type: 'string', example: '17:00' }, isClosed: { type: 'boolean' } } } } },
        },
        RefreshRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string', example: 'eyJ...' } },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
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
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          security: [],
          summary: 'Rotate a refresh token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
          },
          responses: { 200: { description: 'Tokens refreshed' }, 401: { description: 'Invalid refresh token' } },
        },
      },
      '/api/v1/auth/register': {
        post: {
          security: [], summary: 'Register a hospital and administrator',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterHospitalRequest' } } } },
          responses: { 201: { description: 'Hospital registered' }, 409: { description: 'Email already exists' } },
        },
      },
      '/api/v1/auth/change-password': {
        post: {
          summary: 'Change the authenticated user password',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } } },
          responses: { 200: { description: 'Password changed' }, 400: { description: 'Current password is invalid' } },
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
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/HospitalUpdateRequest' } } } },
          responses: { 200: { description: 'Profile updated' } },
        },
      },
      '/api/v1/hospitals/me/settings': {
        put: {
          summary: 'Update hospital settings',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/HospitalSettingsRequest' } } } },
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
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BranchCreateRequest' } } } },
          responses: { 201: { description: 'Branch created' } },
        },
      },
      '/api/v1/hospitals/branches/{branchId}': {
        patch: {
          summary: 'Update branch',
          parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BranchUpdateRequest' } } } },
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
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkingHoursRequest' } } } },
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
}) as swaggerJsdoc.SwaggerDefinition & { paths?: Record<string, Record<string, any>> };

// Every mounted route is part of the public backend contract. Existing entries
// above keep their detailed schemas; this manifest fills only genuinely missing
// operations so Swagger cannot silently drift behind the runtime router.
const publicOperations = new Set([
  'POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'POST /api/v1/auth/register',
  'POST /api/v1/auth/forgot-password', 'POST /api/v1/auth/reset-password',
  'GET /api/v1/auth/verify-email', 'POST /api/v1/auth/verify-email',
]);
for (const route of routeOperations) {
  const pathItem = (generatedOpenapi.paths ??= {})[route.path] ??= {};
  const method = route.method.toLowerCase();
  if (pathItem[method]) continue;
  const operationKey = `${route.method.toUpperCase()} ${route.path}`;
  const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1], in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
  }));
  const operation: Record<string, any> = {
    summary: `${route.method.toUpperCase()} ${route.path.replace(/\{[^}]+\}/g, ':id')}`,
    parameters,
    responses: {
      200: { description: 'Operation completed' },
      201: { description: 'Resource created' },
      401: { description: 'Authentication required' },
      403: { description: 'Insufficient permissions' },
      404: { description: 'Resource not found' },
      422: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
    },
  };
  if (mutationMethods.has(method)) {
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: { type: 'object', additionalProperties: true }, example: {} } },
    };
  }
  if (publicOperations.has(operationKey)) operation.security = [];
  pathItem[method] = operation;
}

// Keep request bodies aligned with the validators in src/routes.  This is
// deliberately explicit: a generic additionalProperties schema is useful only
// as a temporary parity fallback, not as the contract presented to clients.
const objectSchema = (properties: Record<string, any>, required: string[] = []) => ({
  type: 'object', properties, additionalProperties: false,
  ...(required.length ? { required } : {}),
});
const uuidSchema = () => ({ type: 'string', format: 'uuid' });
const dateTimeSchema = () => ({ type: 'string', format: 'date-time' });
const dateSchema = () => ({ type: 'string', format: 'date' });
const text = (min?: number, max?: number) => ({ type: 'string', ...(min === undefined ? {} : { minLength: min }), ...(max === undefined ? {} : { maxLength: max }) });
const numberSchema = (integer = false, minimum?: number, maximum?: number) => ({ type: integer ? 'integer' : 'number', ...(minimum === undefined ? {} : { minimum }), ...(maximum === undefined ? {} : { maximum }) });
const operationBodies: Record<string, any> = {
  'POST /api/v1/patients': objectSchema({ medicalRecordNumber: text(1, 50), firstName: text(1, 100), lastName: text(1, 100), dateOfBirth: dateSchema(), phone: text(undefined, 30), email: { type: 'string', format: 'email' } }, ['medicalRecordNumber', 'firstName', 'lastName', 'dateOfBirth']),
  'PATCH /api/v1/patients/{patientId}': objectSchema({ firstName: text(1, 100), lastName: text(1, 100), dateOfBirth: dateSchema(), phone: { ...text(undefined, 30), nullable: true }, email: { type: 'string', format: 'email', nullable: true } }),
  'POST /api/v1/patients/{patientId}/merge': objectSchema({ targetPatientId: uuidSchema() }, ['targetPatientId']),
  'POST /api/v1/patients/{patientId}/vitals': objectSchema({ temperature: numberSchema(false, 30, 45), systolicBp: numberSchema(true, 50, 250), diastolicBp: numberSchema(true, 30, 150), pulse: numberSchema(true, 20, 250), weightKg: numberSchema(false, 0.5, 500) }),
  'POST /api/v1/patients/{patientId}/allergies': objectSchema({ substance: text(1, 200), severity: { type: 'string', enum: ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'] }, reaction: text(undefined, 500) }, ['substance']),
  'POST /api/v1/patients/{patientId}/insurance': objectSchema({ provider: text(1, 200), policyNumber: text(1, 100), expiresAt: dateTimeSchema() }, ['provider', 'policyNumber']),
  'POST /api/v1/patients/{patientId}/chronic-diseases': objectSchema({ name: text(1, 200), diagnosedAt: dateSchema(), notes: text(undefined, 1000) }, ['name']),
  'POST /api/v1/patients/{patientId}/emergency-contacts': objectSchema({ name: text(1, 200), relationship: text(1, 100), phone: text(1, 30) }, ['name', 'relationship', 'phone']),
  'POST /api/v1/patients/{patientId}/notes': objectSchema({ content: text(1, 5000) }, ['content']),
  'POST /api/v1/patients/{patientId}/discharge-summary': objectSchema({ diagnosis: text(undefined, 2000), summary: text(1, 10000), medications: text(undefined, 5000), followUpInstructions: text(undefined, 5000), dischargedAt: dateTimeSchema() }, ['summary']),
  'POST /api/v1/doctors': objectSchema({ userId: uuidSchema(), specialization: text(2, 200), licenseNumber: text(2, 100), consultationFee: { type: 'number', exclusiveMinimum: 0 }, signatureUrl: { type: 'string', format: 'uri', maxLength: 500 } }, ['userId', 'specialization', 'licenseNumber']),
  'PATCH /api/v1/doctors/{doctorId}': objectSchema({ specialization: text(2, 200), licenseNumber: text(2, 100), consultationFee: { type: 'number', exclusiveMinimum: 0, nullable: true }, signatureUrl: { type: 'string', format: 'uri', maxLength: 500, nullable: true } }),
  'PUT /api/v1/doctors/{doctorId}/availability': objectSchema({ slots: { type: 'array', minItems: 1, maxItems: 21, items: objectSchema({ weekday: numberSchema(true, 0, 6), startsAt: text(5, 5), endsAt: text(5, 5), isAvailable: { type: 'boolean' } }, ['weekday', 'startsAt', 'endsAt']) } }, ['slots']),
  'POST /api/v1/departments': objectSchema({ name: text(2, 120), description: text(undefined, 500) }, ['name']),
  'POST /api/v1/appointments': objectSchema({ patientId: uuidSchema(), doctorId: uuidSchema(), departmentId: uuidSchema(), scheduledAt: dateTimeSchema(), durationMinutes: numberSchema(true, 5, 480), reason: text(undefined, 500) }, ['patientId', 'doctorId', 'scheduledAt']),
  'POST /api/v1/appointments/walk-in': objectSchema({ patientId: uuidSchema(), doctorId: uuidSchema(), departmentId: uuidSchema(), reason: text(undefined, 500) }, ['patientId', 'doctorId']),
  'POST /api/v1/appointments/recurring': objectSchema({ patientId: uuidSchema(), doctorId: uuidSchema(), departmentId: uuidSchema(), durationMinutes: numberSchema(true, 5, 480), reason: text(undefined, 500), dates: { type: 'array', minItems: 2, maxItems: 52, items: dateTimeSchema() } }, ['patientId', 'doctorId', 'dates']),
  'PATCH /api/v1/appointments/{appointmentId}/status': objectSchema({ status: { type: 'string', enum: ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] }, notes: text(undefined, 1000) }, ['status']),
  'POST /api/v1/appointments/{appointmentId}/reschedule': objectSchema({ scheduledAt: dateTimeSchema(), durationMinutes: numberSchema(true, 5, 480) }, ['scheduledAt']),
  'POST /api/v1/appointments/{appointmentId}/cancel': objectSchema({ reason: text(undefined, 500) }),
  'POST /api/v1/medical-records': objectSchema({ patientId: uuidSchema(), recordType: text(2, 80), title: text(2, 200), content: text(1, 10000) }, ['patientId', 'recordType', 'title', 'content']),
  'PATCH /api/v1/medical-records/{recordId}': objectSchema({ title: text(2, 200), content: text(1, 10000), recordType: text(2, 80) }),
  'POST /api/v1/consultations': objectSchema({ patientId: uuidSchema(), doctorId: uuidSchema(), appointmentId: uuidSchema(), clinicalNotes: text(1, 10000), diagnosis: text(undefined, 1000), treatmentPlan: text(undefined, 2000), followUpAt: dateTimeSchema() }, ['patientId', 'doctorId', 'clinicalNotes']),
  'PATCH /api/v1/consultations/{consultationId}': objectSchema({ clinicalNotes: text(1, 10000), diagnosis: text(undefined, 1000), treatmentPlan: text(undefined, 2000), followUpAt: { ...dateTimeSchema(), nullable: true } }),
  'POST /api/v1/prescriptions': objectSchema({ patientId: uuidSchema(), consultationId: uuidSchema(), medicineName: text(1, 200), dosage: text(1, 100), frequency: text(1, 100), durationDays: numberSchema(true, 1), instructions: text(undefined, 1000) }, ['patientId', 'medicineName', 'dosage', 'frequency', 'durationDays']),
  'POST /api/v1/lab-tests': objectSchema({ patientId: uuidSchema(), testName: text(2, 200), referenceRange: text(undefined, 200) }, ['patientId', 'testName']),
  'POST /api/v1/lab-tests/{id}/reject': objectSchema({ reason: text(3, 2000) }, ['reason']),
  'POST /api/v1/medicines': objectSchema({ name: text(2, 200), category: text(undefined, 100), sku: text(2, 100), quantity: numberSchema(true, 0), reorderLevel: numberSchema(true, 0), unitPrice: { type: 'number', exclusiveMinimum: 0 }, expiresAt: dateTimeSchema() }, ['name', 'sku', 'unitPrice']),
  'POST /api/v1/invoices': objectSchema({ patientId: uuidSchema(), invoiceNumber: text(2, 100), items: { type: 'array', minItems: 1, items: objectSchema({ name: text(1, 200), quantity: numberSchema(true, 1), unitPrice: { type: 'number', exclusiveMinimum: 0 } }, ['name', 'quantity', 'unitPrice']) }, discount: { type: 'number', minimum: 0 }, dueAt: dateTimeSchema() }, ['patientId', 'invoiceNumber', 'items']),
  'POST /api/v1/employees': objectSchema({ userId: uuidSchema(), departmentId: uuidSchema(), designation: text(2, 200), joinedAt: dateTimeSchema() }, ['designation', 'joinedAt']),
  'POST /api/v1/notifications': objectSchema({ userId: uuidSchema(), channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] }, title: text(2, 200), body: text(1, 2000) }, ['userId', 'channel', 'title', 'body']),
  'POST /api/v1/inventory': objectSchema({ name: text(2, 200), type: { type: 'string', enum: ['EQUIPMENT', 'CONSUMABLE'] }, category: text(undefined, 100), quantity: numberSchema(true, 0), reorderLevel: numberSchema(true, 0), unitCost: { type: 'number', minimum: 0 }, location: text(undefined, 200), supplierName: text(undefined, 200) }, ['name', 'type']),
  'POST /api/v1/payroll-integrations': objectSchema({ providerName: text(2, 200), status: text(2, 50), configuration: { type: 'object', additionalProperties: true } }, ['providerName']),
  'POST /api/v1/reminders': objectSchema({ type: { type: 'string', enum: ['APPOINTMENT', 'PAYMENT', 'PRESCRIPTION'] }, subject: text(1, 200), body: text(1, 5000), runAt: dateTimeSchema(), userId: uuidSchema() }, ['type', 'subject', 'body', 'runAt']),
  'POST /api/v1/files/upload': objectSchema({ originalName: text(1, 300), mimeType: text(3, 100), sizeBytes: numberSchema(true, 1, 20 * 1024 * 1024), patientId: uuidSchema(), labTestId: uuidSchema(), category: { type: 'string', enum: ['LAB_RESULT', 'RADIOLOGY_REPORT', 'PRESCRIPTION', 'PATIENT_DOCUMENT', 'PROFILE_IMAGE'] } }, ['originalName', 'mimeType', 'sizeBytes']),
  'PATCH /api/v1/auth/profile': objectSchema({ firstName: text(1, 100), lastName: text(1, 100) }),
  'POST /api/v1/auth/change-password': objectSchema({ currentPassword: { type: 'string', format: 'password', minLength: 8 }, newPassword: { type: 'string', format: 'password', minLength: 8, maxLength: 128 } }, ['currentPassword', 'newPassword']),
  'POST /api/v1/auth/forgot-password': objectSchema({ email: { type: 'string', format: 'email' } }, ['email']),
  'POST /api/v1/auth/reset-password': objectSchema({ token: text(1), password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 } }, ['token', 'password']),
  'POST /api/v1/auth/verify-email': objectSchema({ token: text(1) }, ['token']),
  'POST /api/v1/auth/users': objectSchema({ email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 }, firstName: text(1, 100), lastName: text(1, 100), role: { type: 'string', enum: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACIST', 'LABORATORY_TECHNICIAN', 'ACCOUNTANT', 'PATIENT'] } }, ['email', 'password', 'firstName', 'lastName', 'role']),
  'PATCH /api/v1/auth/users/{userId}/role': objectSchema({ role: { type: 'string', enum: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACIST', 'LABORATORY_TECHNICIAN', 'ACCOUNTANT', 'PATIENT'] } }, ['role']),
  'PATCH /api/v1/employees/{id}': objectSchema({ departmentId: { ...uuidSchema(), nullable: true }, designation: text(2, 200), joinedAt: dateTimeSchema() }),
  'POST /api/v1/employees/shifts': objectSchema({ name: text(2, 100), startTime: text(5, 5), endTime: text(5, 5), days: { type: 'array', minItems: 1, items: numberSchema(true, 0, 6) } }, ['name', 'startTime', 'endTime', 'days']),
  'POST /api/v1/employees/{employeeId}/shifts/assign': objectSchema({ shiftId: uuidSchema() }, ['shiftId']),
  'POST /api/v1/employees/{employeeId}/leave': objectSchema({ type: text(2, 100), startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, reason: text(5, 1000) }, ['type', 'startDate', 'endDate', 'reason']),
  'POST /api/v1/employees/{employeeId}/performance-notes': objectSchema({ note: text(10, 2000), rating: numberSchema(true, 1, 5) }, ['note']),
  'POST /api/v1/invoices/{id}/pay': objectSchema({ amount: { type: 'number', exclusiveMinimum: 0 }, method: text(2, 100) }, ['amount', 'method']),
  'POST /api/v1/invoices/{id}/refund': objectSchema({ amount: { type: 'number', exclusiveMinimum: 0 } }, ['amount']),
  'POST /api/v1/invoices/{id}/claims': objectSchema({ provider: text(2, 200), policyNumber: text(2, 100), amountClaimed: { type: 'number', exclusiveMinimum: 0 } }, ['provider', 'policyNumber', 'amountClaimed']),
  'PATCH /api/v1/invoices/{id}/claims/status': objectSchema({ status: text(2, 100) }, ['status']),
  'POST /api/v1/lab-tests/{id}/result': objectSchema({ result: text(1), referenceRange: text(undefined, 200) }, ['result']),
  'POST /api/v1/medicines/batches/{medicineId}': objectSchema({ batchNumber: text(1, 100), quantity: numberSchema(true, 1), expiresAt: dateTimeSchema() }, ['batchNumber', 'quantity']),
  'POST /api/v1/medicines/suppliers': objectSchema({ name: text(2, 200), contactInfo: text(undefined, 300) }, ['name', 'contactInfo']),
  'POST /api/v1/medicines/purchase-orders': objectSchema({ supplierId: text(1), medicineId: uuidSchema(), quantity: numberSchema(true, 1), unitCost: numberSchema(false, 0) }, ['supplierId', 'medicineId', 'quantity']),
  'PATCH /api/v1/medicines/{id}': objectSchema({ name: text(2, 200), category: text(undefined, 100), sku: text(2, 100), quantity: numberSchema(true, 0), reorderLevel: numberSchema(true, 0), unitPrice: { type: 'number', exclusiveMinimum: 0 }, expiresAt: { ...dateTimeSchema(), nullable: true } }),
  'POST /api/v1/notification-templates': objectSchema({ name: text(2, 200), channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] }, title: text(2, 200), body: text(1, 5000) }, ['name', 'channel', 'title', 'body']),
  'PATCH /api/v1/notifications/templates/{id}': objectSchema({ name: text(2, 200), channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] }, title: text(2, 200), body: text(1, 5000) }),
  'POST /api/v1/notifications/broadcast': objectSchema({ channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] }, title: text(2, 200), body: text(1, 2000), userIds: { type: 'array', minItems: 1, items: uuidSchema() } }, ['channel', 'title', 'body', 'userIds']),
  'POST /api/v1/suppliers': objectSchema({ name: text(1, 200), contactName: text(undefined, 200), email: { type: 'string', format: 'email' }, phone: text(undefined, 30), address: text(undefined, 500) }, ['name']),
  'POST /api/v1/insurance-claims': objectSchema({ patientId: uuidSchema(), invoiceId: uuidSchema(), providerName: text(1, 200), amount: { type: 'number', exclusiveMinimum: 0 } }, ['patientId', 'providerName', 'amount']),
  'POST /api/v1/insurance-claims/{id}/reject': objectSchema({ reason: text(1) }, ['reason']),
  'PATCH /api/v1/inventory/{id}': objectSchema({ name: text(2, 200), quantity: numberSchema(true, 0), reorderLevel: numberSchema(true, 0), location: text(undefined, 200), status: { type: 'string', enum: ['ACTIVE', 'RETIRED'] }, supplierName: text(undefined, 200) }),
  'PUT /api/v1/notification-templates/{id}': objectSchema({ subject: text(undefined, 255), body: text(1), channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } }),
  'POST /api/v1/notifications/templates': objectSchema({ name: text(2, 200), channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] }, title: text(2, 200), body: text(1, 5000) }, ['name', 'channel', 'title', 'body']),
  'POST /api/v1/shifts': objectSchema({ name: text(1, 100), startsAt: text(5, 5), endsAt: text(5, 5), description: text(undefined, 500) }, ['name', 'startsAt', 'endsAt']),
  'PUT /api/v1/shifts/{id}': objectSchema({ name: text(1, 100), startsAt: text(5, 5), endsAt: text(5, 5), description: text(undefined, 500), isActive: { type: 'boolean' } }),
  'POST /api/v1/shifts/{id}/assign': objectSchema({ userId: uuidSchema() }, ['userId']),
};
const bodylessOperations = new Set([
  'POST /api/v1/patients/{patientId}/archive', 'POST /api/v1/appointments/{appointmentId}/check-in',
  'POST /api/v1/appointments/{appointmentId}/check-out', 'POST /api/v1/lab-tests/{id}/approve',
  'POST /api/v1/auth/logout', 'POST /api/v1/auth/logout-all', 'POST /api/v1/auth/verify-email/request',
  'POST /api/v1/employees/{employeeId}/attendance/check-in', 'POST /api/v1/employees/{employeeId}/attendance/check-out',
  'POST /api/v1/employees/{employeeId}/leave/{leaveId}/approve', 'POST /api/v1/employees/{employeeId}/leave/{leaveId}/reject',
  'POST /api/v1/insurance-claims/{id}/approve',
  'POST /api/v1/lab-tests/{id}/collect', 'POST /api/v1/lab-tests/{id}/process', 'POST /api/v1/lab-tests/{id}/cancel',
  'POST /api/v1/medicines/dispense/{prescriptionId}', 'POST /api/v1/medicines/purchase-orders/{poId}/receive',
  'POST /api/v1/notifications/{id}/read', 'POST /api/v1/notifications/{id}/unread',
]);
for (const [operationKey, schema] of Object.entries(operationBodies)) {
  const separator = operationKey.indexOf(' ');
  const method = operationKey.slice(0, separator);
  const path = operationKey.slice(separator + 1);
  const operation = (generatedOpenapi.paths?.[path] as Record<string, any> | undefined)?.[method.toLowerCase()];
  if (operation) operation.requestBody = { required: true, content: { 'application/json': { schema } } };
}
for (const operationKey of bodylessOperations) {
  const separator = operationKey.indexOf(' ');
  const method = operationKey.slice(0, separator);
  const path = operationKey.slice(separator + 1);
  const operation = (generatedOpenapi.paths?.[path] as Record<string, any> | undefined)?.[method.toLowerCase()];
  if (operation) delete operation.requestBody;
}

// These create handlers intentionally return 201 Created. Keep the published
// contract aligned with the implementation and HTTP semantics.
for (const operationKey of [
  'POST /api/v1/notifications/templates',
  'POST /api/v1/shifts',
  'POST /api/v1/suppliers',
]) {
  const separator = operationKey.indexOf(' ');
  const method = operationKey.slice(0, separator).toLowerCase();
  const path = operationKey.slice(separator + 1);
  const operation = (generatedOpenapi.paths?.[path] as Record<string, any> | undefined)?.[method];
  if (operation?.responses?.['201']) {
    delete operation.responses['200'];
  }
}

// Keep Swagger usable for every documented mutation even when a module-specific
// schema has not yet been expanded. This guarantees an editable JSON body rather
// than silently rendering “No parameters”; module schemas should replace this
// fallback as their contracts evolve.
for (const [path, pathItem] of Object.entries(generatedOpenapi.paths ?? {})) {
  for (const method of mutationMethods) {
    const operation = (pathItem as Record<string, any>)[method];
    const isBodyless = bodylessOperations.has(`${method.toUpperCase()} ${path}`);
    if (operation && !operation.requestBody && !isBodyless) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
            example: {},
          },
        },
      };
    }
  }
  for (const operation of Object.values(pathItem as Record<string, any>)) {
    if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
    const responses = (operation as Record<string, any>).responses;
    responses['401'] ??= { description: 'Authentication required' };
    responses['403'] ??= { description: 'Insufficient permissions' };
    responses['404'] ??= { description: 'Resource not found' };
    responses['422'] ??= { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } };
  }
}

export const openapi = generatedOpenapi;
