import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiGet, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Button } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { TextField } from '../components/ui/Field';
import type { Supplier } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function SuppliersPage() {
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: qk.suppliers,
    queryFn: async () => {
      const raw = await apiGet<Supplier[] | { data?: Supplier[] }>('/medicines/suppliers/list');
      return Array.isArray(raw) ? raw : (raw.data ?? []);
    },
  });

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'Supplier', render: (s) => <span className="font-semibold text-slate-800">{s.name}</span> },
    { key: 'contact', header: 'Contact', render: (s) => s.contactInfo || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Procurement partners for pharmacy and inventory."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Add supplier
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data}
        rowKey={(s) => s.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No suppliers"
      />
      <AddModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', contactInfo: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) => apiPost('/medicines/suppliers', b),
    invalidate: [qk.suppliers],
    successMessage: 'Supplier added.',
    onSuccess: () => {
      setForm({ name: '', contactInfo: '' });
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
      title="Add supplier"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-sup" type="submit" loading={mutation.isPending}>
            Add
          </Button>
        </>
      }
    >
      <form id="new-sup" onSubmit={submit} className="space-y-4">
        <TextField label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
        <TextField label="Contact info" required value={form.contactInfo} onChange={(e) => setForm((f) => ({ ...f, contactInfo: e.target.value }))} error={errors.contactInfo} hint="Phone, email or address." />
      </form>
    </Modal>
  );
}
