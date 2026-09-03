import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useDebounced, useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/primitives';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextField } from '../components/ui/Field';
import { useDepartmentOptions } from '../api/lookups';
import { fmtDate } from '../lib/format';
import { ApiError } from '../lib/apiError';

interface EmployeeRow {
  id: string;
  designation: string;
  joinedAt?: string;
  department?: { name?: string } | null;
  user?: { firstName?: string; lastName?: string; email?: string } | null;
}

export function EmployeesPage() {
  const { page, search, setSearch, setPage } = useListParams();
  const [term, setTerm] = useState(search);
  const debounced = useDebounced(term, 350);
  const [open, setOpen] = useState(false);

  useEffect(() => setSearch(debounced), [debounced, setSearch]);

  const params = { page, limit: 20, search: search || undefined };
  const query = useQuery({
    queryKey: qk.employees(params),
    queryFn: () => apiList<EmployeeRow>('/employees', params),
    placeholderData: (p) => p,
  });

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (e) => (
        <div>
          <p className="font-semibold text-slate-800">
            {e.user ? `${e.user.firstName ?? ''} ${e.user.lastName ?? ''}`.trim() || e.user.email : e.designation}
          </p>
          <p className="text-xs text-slate-400">{e.user?.email}</p>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation', render: (e) => e.designation },
    { key: 'dept', header: 'Department', render: (e) => e.department?.name || '—' },
    { key: 'joined', header: 'Joined', render: (e) => fmtDate(e.joinedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Staff / HR"
        subtitle="Employee register, designations and department assignment."
        actions={
          <>
            <SearchInput value={term} onChange={setTerm} placeholder="Search staff…" />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Add employee
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(e) => e.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No employees"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <AddModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const departments = useDepartmentOptions();
  const [form, setForm] = useState({
    designation: '',
    departmentId: '',
    joinedAt: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/employees', {
        designation: b.designation,
        departmentId: b.departmentId || undefined,
        joinedAt: new Date(b.joinedAt).toISOString(),
      }),
    invalidate: [['employees']],
    successMessage: 'Employee added.',
    onSuccess: () => {
      setForm((f) => ({ ...f, designation: '' }));
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
      title="Add employee"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-emp" type="submit" loading={mutation.isPending}>
            Add
          </Button>
        </>
      }
    >
      <form id="new-emp" onSubmit={submit} className="space-y-4">
        <TextField label="Designation" required value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} error={errors.designation} />
        <SelectField
          label="Department"
          placeholder="Unassigned"
          options={departments.options}
          value={form.departmentId}
          onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
          error={errors.departmentId}
        />
        <TextField label="Joined at" type="date" required value={form.joinedAt} onChange={(e) => setForm((f) => ({ ...f, joinedAt: e.target.value }))} error={errors.joinedAt} />
      </form>
    </Modal>
  );
}
