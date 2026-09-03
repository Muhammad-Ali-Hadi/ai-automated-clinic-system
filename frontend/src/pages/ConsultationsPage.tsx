import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Stethoscope } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { useAuth } from '../features/auth/AuthProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { usePatientOptions, useDoctorOptions } from '../api/lookups';
import { fmtDateTime, fmtTime, fullName, titleCase } from '../lib/format';
import type { Appointment, Consultation } from '../lib/types';
import { ApiError } from '../lib/apiError';

const OPEN_STATUSES = ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS'];

export function ConsultationsPage() {
  const { page, setPage } = useListParams();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get('new') === '1');
  const [seed, setSeed] = useState<{ patientId?: string; appointmentId?: string }>({});

  useEffect(() => {
    if (sp.get('new') === '1') {
      setSeed({ patientId: sp.get('patientId') ?? undefined, appointmentId: sp.get('appointmentId') ?? undefined });
      setOpen(true);
      sp.delete('new');
      sp.delete('patientId');
      sp.delete('appointmentId');
      setSp(sp, { replace: true });
    }
  }, [sp, setSp]);

  const params = { page, limit: 15 };
  const query = useQuery({
    queryKey: qk.consultations(params),
    queryFn: () => apiList<Consultation>('/consultations', params),
    placeholderData: (p) => p,
  });

  const columns: Column<Consultation>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (c) =>
        c.patient ? (
          <Link to={`/patients/${c.patientId}`} className="font-semibold text-brand-700 hover:underline">
            {fullName(c.patient)}
          </Link>
        ) : (
          <span className="font-mono text-xs text-slate-400">{c.patientId.slice(0, 8)}</span>
        ),
    },
    { key: 'diagnosis', header: 'Diagnosis', render: (c) => c.diagnosis || '—' },
    { key: 'notes', header: 'Clinical notes', render: (c) => <span className="line-clamp-1">{c.clinicalNotes}</span> },
    { key: 'followUp', header: 'Follow-up', render: (c) => (c.followUpAt ? fmtDateTime(c.followUpAt) : '—') },
    { key: 'created', header: 'Recorded', render: (c) => fmtDateTime(c.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Consultations"
        subtitle="Record clinical encounters, diagnoses and treatment plans."
        actions={
          <Button
            icon={<Stethoscope className="h-4 w-4" />}
            onClick={() => {
              setSeed({});
              setOpen(true);
            }}
          >
            New consultation
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(c) => c.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No consultations recorded"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <NewConsultationModal open={open} onClose={() => setOpen(false)} seed={seed} />
    </>
  );
}

function NewConsultationModal({
  open,
  onClose,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  seed: { patientId?: string; appointmentId?: string };
}) {
  const { user } = useAuth();
  const patients = usePatientOptions();
  const doctors = useDoctorOptions();

  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    appointmentId: '',
    clinicalNotes: '',
    diagnosis: '',
    treatmentPlan: '',
    followUpAt: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The doctor profile that belongs to the signed-in user, if any.
  const myDoctorId = useMemo(
    () => doctors.data?.items.find((d) => d.userId === user?.id)?.id ?? '',
    [doctors.data, user?.id],
  );

  // Open visits for the chosen patient, so the consultation can be tied to one.
  const appts = useQuery({
    queryKey: qk.appointments({ forConsult: true, patientId: form.patientId }),
    queryFn: () => apiList<Appointment>('/appointments', { patientId: form.patientId, limit: 20 }),
    enabled: open && !!form.patientId,
  });
  const apptOptions = (appts.data?.items ?? [])
    .filter((a) => OPEN_STATUSES.includes(a.status))
    .map((a) => ({
      value: a.id,
      label: `${fmtTime(a.scheduledAt)} · ${titleCase(a.status)}${a.reason ? ` · ${a.reason}` : ''}`,
    }));

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm((f) => ({
      ...f,
      patientId: seed.patientId ?? '',
      appointmentId: seed.appointmentId ?? '',
      doctorId: f.doctorId || myDoctorId,
      clinicalNotes: '',
      diagnosis: '',
      treatmentPlan: '',
      followUpAt: '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed.patientId, seed.appointmentId]);

  // Fill the doctor once the profile list resolves.
  useEffect(() => {
    if (open && !form.doctorId && myDoctorId) setForm((f) => ({ ...f, doctorId: myDoctorId }));
  }, [open, myDoctorId, form.doctorId]);

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/consultations', {
        patientId: b.patientId,
        doctorId: b.doctorId,
        appointmentId: b.appointmentId || undefined,
        clinicalNotes: b.clinicalNotes,
        diagnosis: b.diagnosis || undefined,
        treatmentPlan: b.treatmentPlan || undefined,
        followUpAt: b.followUpAt ? new Date(b.followUpAt).toISOString() : undefined,
      }),
    invalidate: [['consultations'], ['patient'], ['appointments'], ['queue']],
    successMessage: 'Consultation recorded.',
    onSuccess: () => onClose(),
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
      title="New consultation"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-consult" type="submit" loading={mutation.isPending}>
            Save consultation
          </Button>
        </>
      }
    >
      <form id="new-consult" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Patient"
            required
            placeholder="Select patient"
            options={patients.options}
            value={form.patientId}
            onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value, appointmentId: '' }))}
            error={errors.patientId}
          />
          <SelectField
            label="Doctor"
            required
            placeholder="Select doctor"
            options={doctors.options}
            value={form.doctorId}
            onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
            error={errors.doctorId}
          />
        </div>

        <SelectField
          label="Visit / appointment"
          placeholder={
            !form.patientId
              ? 'Select a patient first'
              : appts.isLoading
                ? 'Loading visits…'
                : apptOptions.length
                  ? 'Not linked to a visit'
                  : 'No open visits for this patient'
          }
          options={apptOptions}
          value={form.appointmentId}
          onChange={(e) => setForm((f) => ({ ...f, appointmentId: e.target.value }))}
          hint="Linking a checked-in visit moves it to “In consultation” on the Live Queue."
          error={errors.appointmentId}
        />

        <TextAreaField
          label="Clinical notes"
          required
          rows={4}
          value={form.clinicalNotes}
          onChange={(e) => setForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
          error={errors.clinicalNotes}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Diagnosis"
            value={form.diagnosis}
            onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
            error={errors.diagnosis}
          />
          <TextField
            label="Follow-up at"
            type="datetime-local"
            value={form.followUpAt}
            onChange={(e) => setForm((f) => ({ ...f, followUpAt: e.target.value }))}
            error={errors.followUpAt}
          />
        </div>
        <TextAreaField
          label="Treatment plan"
          value={form.treatmentPlan}
          onChange={(e) => setForm((f) => ({ ...f, treatmentPlan: e.target.value }))}
          error={errors.treatmentPlan}
        />
      </form>
    </Modal>
  );
}
