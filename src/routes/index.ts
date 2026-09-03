import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { patientRouter } from './patient.routes.js';
import { departmentRouter } from './department.routes.js';
import { appointmentRouter } from './appointment.routes.js';
import { medicalRecordRouter } from './medical-record.routes.js';
import { hospitalRouter } from './hospital.routes.js';
import { doctorRouter } from './doctor.routes.js';
import { consultationRouter } from './consultation.routes.js';
import { prescriptionRouter } from './prescription.routes.js';
// Batch 2
import { labTestRouter } from './lab-test.routes.js';
import { medicineRouter } from './medicine.routes.js';
import { invoiceRouter } from './invoice.routes.js';
import { employeeRouter } from './employee.routes.js';
import { notificationRouter } from './notification.routes.js';
import { reportRouter } from './report.routes.js';
import { fileRouter } from './file.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { payrollRouter } from './payroll.routes.js';
import { reminderRouter } from './reminder.routes.js';
// Batch 3
import { notificationTemplateRouter } from './notification-template.routes.js';
import { insuranceRouter } from './insurance.routes.js';
import { supplierRouter } from './supplier.routes.js';
import { shiftRouter } from './shifts.routes.js';
import { auditRouter } from './audit.routes.js';
import { aiRouter } from './ai.routes.js';

export const apiRouter = Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/patients', patientRouter);
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/appointments', appointmentRouter);
apiRouter.use('/medical-records', medicalRecordRouter);
apiRouter.use('/hospitals', hospitalRouter);
apiRouter.use('/doctors', doctorRouter);
apiRouter.use('/consultations', consultationRouter);
apiRouter.use('/prescriptions', prescriptionRouter);
// Batch 2
apiRouter.use('/lab-tests', labTestRouter);
apiRouter.use('/medicines', medicineRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/files', fileRouter);


apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/payroll-integrations', payrollRouter);
apiRouter.use('/reminders', reminderRouter);
// Batch 3
apiRouter.use('/notification-templates', notificationTemplateRouter);
apiRouter.use('/insurance-claims', insuranceRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/shifts', shiftRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/ai', aiRouter);
