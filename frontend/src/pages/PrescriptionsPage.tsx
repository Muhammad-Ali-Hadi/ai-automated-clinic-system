import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardPlus } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { usePatientOptions } from '../api/lookups';
import { fmtDateTime, fullName } from '../lib/format';
import type { Prescription } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function PrescriptionsPage() {
  const { page, setPage } = useListParams();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get('new') === '1');

  useEffect(() => {
    if (sp.get('new') === '1') {
      setOpen(true);
      sp.delete('new');
      setSp(sp, { replace: true });
    }
  }, [sp, setSp]);

  const params = { page, limit: 15 };
  const query = useQuery({
    queryKey: qk.prescriptions(params),
    queryFn: () => apiList<Prescription>('/prescriptions', params),
    placeholderData: (p) => p,
  });

  const columns: Column<Prescription>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (rx) =>
        rx.patient ? (
          <Link to={`/patients/${rx.patientId}`} className="font-semibold text-brand-700 hover:underline">
            {fullName(rx.patient)}
          </Link>
        ) : (
          <span className="font-mono text-xs text-slate-400">{rx.patientId.slice(0, 8)}</span>
        ),
    },
    { key: 'medicine', header: 'Medicine', render: (rx) => <span className="font-medium">{rx.medicineName}</span> },
    { key: 'dosage', header: 'Dosage', render: (rx) => `${rx.dosage} · ${rx.frequency}` },
    { key: 'duration', header: 'Duration', render: (rx) => `${rx.durationDays} days` },
    { key: 'status', header: 'Status', render: (rx) => <Badge value={rx.status ?? 'ACTIVE'} /> },
    { key: 'created', header: 'Issued', render: (rx) => fmtDateTime(rx.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Digital prescriptions issued from consultations."
        actions={
          <Button icon={<ClipboardPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New prescription
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(rx) => rx.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No prescriptions issued"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <NewPrescriptionModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NewPrescriptionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const patients = usePatientOptions();
  const [form, setForm] = useState({
    patientId: '',
    medicineName: '',
    dosage: '',
    frequency: '',
    durationDays: '5',
    instructions: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/prescriptions', {
        patientId: b.patientId,
        medicineName: b.medicineName,
        dosage: b.dosage,
        frequency: b.frequency,
        durationDays: Number(b.durationDays),
        instructions: b.instructions || undefined,
      }),
    invalidate: [['prescriptions'], ['patient']],
    successMessage: 'Prescription issued.',
    onSuccess: () => {
      setForm((f) => ({ ...f, medicineName: '', dosage: '', frequency: '', instructions: '' }));
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
      title="New prescription"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-rx" type="submit" loading={mutation.isPending}>
            Issue
          </Button>
        </>
      }
    >
      <form id="new-rx" onSubmit={submit} className="space-y-4">
        <SelectField
          label="Patient"
          required
          placeholder="Select patient"
          options={patients.options}
          value={form.patientId}
          onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
          error={errors.patientId}
        />
        <TextField
          label="Medicine name"
          required
          value={form.medicineName}
          onChange={(e) => setForm((f) => ({ ...f, medicineName: e.target.value }))}
          error={errors.medicineName}
        />
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Dosage"
            required
            placeholder="500mg"
            value={form.dosage}
            onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            error={errors.dosage}
          />
          <TextField
            label="Frequency"
            required
            placeholder="2x/day"
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            error={errors.frequency}
          />
          <TextField
            label="Duration (days)"
            type="number"
            required
            value={form.durationDays}
            onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
            error={errors.durationDays}
          />
        </div>
        <TextAreaField
          label="Instructions"
          value={form.instructions}
          onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
          error={errors.instructions}
        />
      </form>
    </Modal>
  );
}
