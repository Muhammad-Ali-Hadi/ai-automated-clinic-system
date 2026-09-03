import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { TextAreaField, TextField } from '../components/ui/Field';
import type { Department } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function DepartmentsPage() {
  const { page, setPage } = useListParams();
  const [open, setOpen] = useState(false);
  const params = { page, limit: 20 };
  const query = useQuery({
    queryKey: qk.departments(params),
    queryFn: () => apiList<Department>('/departments', params),
    placeholderData: (p) => p,
  });

  const columns: Column<Department>[] = [
    { key: 'name', header: 'Department', render: (d) => <span className="font-semibold text-slate-800">{d.name}</span> },
    { key: 'desc', header: 'Description', render: (d) => d.description || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Clinical and operational units within the hospital."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New department
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
        emptyTitle="No departments"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <CreateModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) => apiPost('/departments', { name: b.name, description: b.description || undefined }),
    invalidate: [['departments']],
    successMessage: 'Department created.',
    onSuccess: () => {
      setForm({ name: '', description: '' });
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
      title="New department"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-dept" type="submit" loading={mutation.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="new-dept" onSubmit={submit} className="space-y-4">
        <TextField label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
        <TextAreaField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} error={errors.description} />
      </form>
    </Modal>
  );
}
