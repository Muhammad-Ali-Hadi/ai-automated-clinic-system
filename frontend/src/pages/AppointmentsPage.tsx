import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, LogIn, LogOut, XCircle } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { SelectField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { TextField, TextAreaField } from '../components/ui/Field';
import { usePatientOptions, useDoctorOptions, useDepartmentOptions } from '../api/lookups';
import { fmtDateTime, fullName } from '../lib/format';
import type { Appointment } from '../lib/types';
import { ApiError } from '../lib/apiError';

const STATUSES = ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function AppointmentsPage() {
  const { page, get, patch, setPage } = useListParams();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get('new') === '1');
  const status = get('status');

  useEffect(() => {
    if (sp.get('new') === '1') {
      setOpen(true);
      sp.delete('new');
      setSp(sp, { replace: true });
    }
  }, [sp, setSp]);

  const params = { page, limit: 15, status: status || undefined };
  const query = useQuery({
    queryKey: qk.appointments(params),
    queryFn: () => apiList<Appointment>('/appointments', params),
    placeholderData: (p) => p,
  });

  const action = useApiMutation<{ id: string; kind: 'check-in' | 'check-out' | 'cancel' }>({
    mutationFn: ({ id, kind }) =>
      apiPost(`/appointments/${id}/${kind}`, kind === 'cancel' ? { reason: 'Cancelled from console' } : undefined),
    invalidate: [['appointments'], ['queue']],
    successMessage: 'Appointment updated.',
  });

  const columns: Column<Appointment>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (a) =>
        a.patient ? (
          <Link to={`/patients/${a.patientId}`} className="font-semibold text-brand-700 hover:underline">
            {fullName(a.patient)}
          </Link>
        ) : (
          <span className="font-mono text-xs text-slate-400">{a.patientId.slice(0, 8)}</span>
        ),
    },
    { key: 'when', header: 'Scheduled', render: (a) => fmtDateTime(a.scheduledAt) },
    { key: 'reason', header: 'Reason', render: (a) => a.reason || '—' },
    { key: 'status', header: 'Status', render: (a) => <Badge value={a.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <div className="flex justify-end gap-1">
          {a.status === 'BOOKED' && (
            <Button
              variant="outline"
              className="px-2 py-1 text-xs"
              icon={<LogIn className="h-3.5 w-3.5" />}
              loading={action.isPending}
              onClick={() => action.mutate({ id: a.id, kind: 'check-in' })}
            >
              Check in
            </Button>
          )}
          {(a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS') && (
            <Button
              variant="outline"
              className="px-2 py-1 text-xs"
              icon={<LogOut className="h-3.5 w-3.5" />}
              loading={action.isPending}
              onClick={() => action.mutate({ id: a.id, kind: 'check-out' })}
            >
              Check out
            </Button>
          )}
          {!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status) && (
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs text-rose-600"
              icon={<XCircle className="h-3.5 w-3.5" />}
              onClick={() => action.mutate({ id: a.id, kind: 'cancel' })}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Book visits, run check-in / check-out, and manage the schedule."
        actions={
          <>
            <SelectField
              wrapClassName="w-44"
              value={status}
              onChange={(e) => patch({ status: e.target.value || undefined })}
              options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
            />
            <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Book appointment
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(a) => a.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No appointments"
        emptyHint="Book the first appointment to populate the queue."
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}

      <BookModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function BookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const patients = usePatientOptions();
  const doctors = useDoctorOptions();
  const departments = useDepartmentOptions();

  const nowLocal = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, []);

  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    departmentId: '',
    scheduledAt: nowLocal,
    durationMinutes: '30',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, scheduledAt: nowLocal }));
  }, [open, nowLocal]);

  const mutation = useApiMutation<typeof form>({
    mutationFn: (body) =>
      apiPost('/appointments', {
        patientId: body.patientId,
        doctorId: body.doctorId,
        departmentId: body.departmentId || undefined,
        scheduledAt: new Date(body.scheduledAt).toISOString(),
        durationMinutes: Number(body.durationMinutes),
        reason: body.reason || undefined,
      }),
    invalidate: [['appointments'], ['queue']],
    successMessage: 'Appointment booked.',
    onSuccess: () => {
      setForm((f) => ({ ...f, reason: '' }));
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    mutation.mutate(form, { onError: (err) => err instanceof ApiError && setErrors(err.fieldMap) });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book appointment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="book-appt" type="submit" loading={mutation.isPending}>
            Book
          </Button>
        </>
      }
    >
      <form id="book-appt" onSubmit={submit} className="space-y-4">
        <SelectField
          label="Patient"
          required
          placeholder={patients.isLoading ? 'Loading…' : 'Select patient'}
          options={patients.options}
          value={form.patientId}
          onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
          error={errors.patientId}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Doctor"
            required
            placeholder={doctors.isLoading ? 'Loading…' : 'Select doctor'}
            options={doctors.options}
            value={form.doctorId}
            onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
            error={errors.doctorId}
          />
          <SelectField
            label="Department"
            placeholder="Optional"
            options={departments.options}
            value={form.departmentId}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            error={errors.departmentId}
          />
          <TextField
            label="Scheduled at"
            type="datetime-local"
            required
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            error={errors.scheduledAt}
          />
          <TextField
            label="Duration (min)"
            type="number"
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
            error={errors.durationMinutes}
          />
        </div>
        <TextAreaField
          label="Reason"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          error={errors.reason}
        />
        {doctors.options.length === 0 && !doctors.isLoading && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No doctors yet — add one under <b>Doctors</b> first.
          </p>
        )}
      </form>
    </Modal>
  );
}
