import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, UserRound } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useDebounced, useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { TextField, SelectField } from '../components/ui/Field';
import { ageFrom, fmtDate, fullName } from '../lib/format';
import type { Patient } from '../lib/types';
import { ApiError } from '../lib/apiError';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'MERGED', label: 'Merged' },
  { value: 'DECEASED', label: 'Deceased' },
];

export function PatientsPage() {
  const navigate = useNavigate();
  const { page, search, get, patch, setPage, setSearch } = useListParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [term, setTerm] = useState(search);
  const debounced = useDebounced(term, 350);
  const status = get('status');

  useEffect(() => setSearch(debounced), [debounced, setSearch]);
  useEffect(() => setTerm(search), [search]);

  const [open, setOpen] = useState(searchParams.get('new') === '1');
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const params = { page, limit: 15, search: search || undefined, status: status || undefined };
  const query = useQuery({
    queryKey: qk.patients(params),
    queryFn: () => apiList<Patient>('/patients', params),
    placeholderData: (prev) => prev,
  });

  const columns: Column<Patient>[] = [
    {
      key: 'name',
      header: 'Patient',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
            {(p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{fullName(p)}</p>
            <p className="text-xs text-slate-400">{p.medicalRecordNumber}</p>
          </div>
        </div>
      ),
    },
    { key: 'dob', header: 'Date of birth', render: (p) => `${fmtDate(p.dateOfBirth)} · ${ageFrom(p.dateOfBirth)}` },
    { key: 'phone', header: 'Contact', render: (p) => p.phone || p.email || '—' },
    { key: 'status', header: 'Status', render: (p) => <Badge value={p.status ?? 'ACTIVE'} /> },
    { key: 'created', header: 'Registered', render: (p) => fmtDate(p.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Register and manage the patient roster for your hospital."
        actions={
          <>
            <SearchInput value={term} onChange={setTerm} placeholder="Name or MRN…" />
            <SelectField
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => patch({ status: e.target.value || undefined })}
              wrapClassName="w-40"
            />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Register patient
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(p) => p.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        onRowClick={(p) => navigate(`/patients/${p.id}`)}
        emptyTitle="No patients found"
        emptyHint="Register your first patient to begin the workflow."
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          totalPages={query.data.totalPages}
          total={query.data.total}
          onPage={setPage}
        />
      )}

      <NewPatientModal open={open} onClose={() => setOpen(false)} onCreated={(id) => navigate(`/patients/${id}`)} />
    </>
  );
}

function NewPatientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const empty = {
    medicalRecordNumber: `MRN-${Date.now().toString().slice(-6)}`,
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({ ...empty, medicalRecordNumber: `MRN-${Date.now().toString().slice(-6)}` });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useApiMutation<typeof form, Patient>({
    mutationFn: (body) =>
      apiPost<Patient>('/patients', {
        medicalRecordNumber: body.medicalRecordNumber,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        phone: body.phone || undefined,
        email: body.email || undefined,
      }),
    invalidate: [['patients']],
    successMessage: (p) => `Patient ${fullName(p)} registered.`,
    onSuccess: (p) => {
      onClose();
      if (p?.id) onCreated(p.id);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    mutation.mutate(form, {
      onError: (err) => err instanceof ApiError && setErrors(err.fieldMap),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register patient"
      description="Creates a new patient record in your hospital."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-patient" type="submit" loading={mutation.isPending}>
            Register
          </Button>
        </>
      }
    >
      <form id="new-patient" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Medical record no." required value={form.medicalRecordNumber} onChange={set('medicalRecordNumber')} error={errors.medicalRecordNumber} />
          <TextField label="Date of birth" type="date" required value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} />
          <TextField label="First name" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
          <TextField label="Last name" required value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} />
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <UserRound className="h-3.5 w-3.5" />
          Allergies, insurance and vitals can be added from the patient record.
        </p>
      </form>
    </Modal>
  );
}
