import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgePlus } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextField } from '../components/ui/Field';
import { fmtMoney, fullName } from '../lib/format';
import type { Doctor, UserRow } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function DoctorsPage() {
  const { page, setPage } = useListParams();
  const [open, setOpen] = useState(false);
  const params = { page, limit: 20 };

  const query = useQuery({
    queryKey: qk.doctors(params),
    queryFn: () => apiList<Doctor>('/doctors', params),
    placeholderData: (p) => p,
  });

  const columns: Column<Doctor>[] = [
    {
      key: 'name',
      header: 'Doctor',
      render: (d) => (
        <div>
          <p className="font-semibold text-slate-800">{d.user ? fullName(d.user) : d.specialization}</p>
          <p className="text-xs text-slate-400">{d.user?.email}</p>
        </div>
      ),
    },
    { key: 'spec', header: 'Specialization', render: (d) => d.specialization },
    { key: 'license', header: 'License', render: (d) => <span className="font-mono text-xs">{d.licenseNumber}</span> },
    { key: 'fee', header: 'Consultation fee', align: 'right', render: (d) => fmtMoney(d.consultationFee ?? null) },
  ];

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Clinical practitioner profiles and consultation fees."
        actions={
          <Button icon={<BadgePlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Add doctor profile
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(d) => d.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No doctor profiles"
        emptyHint="Create a DOCTOR user first, then add a profile here."
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <AddModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const users = useQuery({
    queryKey: qk.users({ role: 'DOCTOR', picker: true }),
    queryFn: () => apiList<UserRow>('/auth/users', { limit: 100 }),
    enabled: open,
  });

  const doctorUsers = (users.data?.items ?? []).filter((u) => u.role === 'DOCTOR');

  const [form, setForm] = useState({
    userId: '',
    specialization: '',
    licenseNumber: '',
    consultationFee: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/doctors', {
        userId: b.userId,
        specialization: b.specialization,
        licenseNumber: b.licenseNumber,
        consultationFee: b.consultationFee ? Number(b.consultationFee) : undefined,
      }),
    invalidate: [['doctors']],
    successMessage: 'Doctor profile created.',
    onSuccess: () => {
      setForm({ userId: '', specialization: '', licenseNumber: '', consultationFee: '' });
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
      title="Add doctor profile"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-doc" type="submit" loading={mutation.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="new-doc" onSubmit={submit} className="space-y-4">
        <SelectField
          label="User account (role: Doctor)"
          required
          placeholder={users.isLoading ? 'Loading…' : doctorUsers.length ? 'Select user' : 'No DOCTOR users found'}
          options={doctorUsers.map((u) => ({ value: u.id, label: `${fullName(u)} · ${u.email}` }))}
          value={form.userId}
          onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
          error={errors.userId}
        />
        <TextField label="Specialization" required value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} error={errors.specialization} />
        <TextField label="License number" required value={form.licenseNumber} onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))} error={errors.licenseNumber} />
        <TextField label="Consultation fee" type="number" step="0.01" value={form.consultationFee} onChange={(e) => setForm((f) => ({ ...f, consultationFee: e.target.value }))} error={errors.consultationFee} />
        {doctorUsers.length === 0 && !users.isLoading && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Create a user with the <b>Doctor</b> role under <b>Users &amp; roles</b> first.
          </p>
        )}
      </form>
    </Modal>
  );
}
