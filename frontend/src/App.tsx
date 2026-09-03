import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireAuth } from './features/auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { CenteredSpinner } from './components/ui/primitives';

// Route-level code splitting: each screen (and its heavy deps like charts) loads
// on demand, keeping the initial bundle small.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AiAssistantPage = lazy(() => import('./pages/AiAssistantPage').then((m) => ({ default: m.AiAssistantPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const PatientsPage = lazy(() => import('./pages/PatientsPage').then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage').then((m) => ({ default: m.PatientDetailPage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const QueuePage = lazy(() => import('./pages/QueuePage').then((m) => ({ default: m.QueuePage })));
const ConsultationsPage = lazy(() => import('./pages/ConsultationsPage').then((m) => ({ default: m.ConsultationsPage })));
const PrescriptionsPage = lazy(() => import('./pages/PrescriptionsPage').then((m) => ({ default: m.PrescriptionsPage })));
const LabTestsPage = lazy(() => import('./pages/LabTestsPage').then((m) => ({ default: m.LabTestsPage })));
const PharmacyPage = lazy(() => import('./pages/PharmacyPage').then((m) => ({ default: m.PharmacyPage })));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage').then((m) => ({ default: m.DoctorsPage })));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function Fallback() {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center">
      <CenteredSpinner />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="ai" element={<AiAssistantPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/:patientId" element={<PatientDetailPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="consultations" element={<ConsultationsPage />} />
            <Route path="prescriptions" element={<PrescriptionsPage />} />
            <Route path="lab-tests" element={<LabTestsPage />} />
            <Route path="pharmacy" element={<PharmacyPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
