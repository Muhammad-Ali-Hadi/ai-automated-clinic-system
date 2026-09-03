import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { apiGet, apiList, apiPatch, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextField } from '../components/ui/Field';
import { fmtDate, fullName, titleCase } from '../lib/format';
import type { Role, UserRow } from '../lib/types';
import { ApiError } from '../lib/apiError';

const ASSIGNABLE_ROLES: Role[] = [
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'RECEPTIONIST',
  'NURSE',
  'PHARMACIST',
  'LABORATORY_TECHNICIAN',
  'ACCOUNTANT',
];

export function UsersPage() {
  const { page, setPage } = useListParams();
  const [open, setOpen] = useState(false);
  const params = { page, limit: 20 };

  const query = useQuery({
    queryKey: qk.users(params),
    queryFn: () => apiList<UserRow>('/auth/users', params),
    placeholderData: (p) => p,
  });

  const changeRole = useApiMutation<{ id: string; role: Role }>({
    mutationFn: ({ id, role }) => apiPatch(`/auth/users/${id}/role`, { role }),
    invalidate: [['users']],
    successMessage: 'Role updated.',
  });

  const columns: Column<UserRow>[] = [
    { key: 'name', header: 'Name', render: (u) => <span className="font-semibold text-slate-800">{fullName(u)}</span> },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <select
          className="input h-8 w-44 py-1 text-xs"
          value={u.role}
          onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {titleCase(r)}
            </option>
          ))}
        </select>
      ),
    },
    { key: 'active', header: 'Status', render: (u) => <Badge value={u.isActive === false ? 'archived' : 'active'} /> },
    { key: 'created', header: 'Created', render: (u) => fmtDate(u.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle="Provision staff accounts and manage role-based access."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Add user
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(u) => u.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No users"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <AddUserModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiGet<{ roles: string[] }>('/auth/roles'),
    staleTime: Infinity,
  });

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'RECEPTIONIST' as Role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const options = (roles.data?.roles ?? ASSIGNABLE_ROLES)
    .filter((r) => r !== 'SUPER_ADMIN' && r !== 'PATIENT')
    .map((r) => ({ value: r, label: titleCase(r) }));

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) => apiPost('/auth/users', b),
    invalidate: [['users']],
    successMessage: (_d, v) => `${v.firstName} added as ${titleCase(v.role)}.`,
    onSuccess: () => {
      setForm((f) => ({ ...f, firstName: '', lastName: '', email: '', password: '' }));
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
      title="Add user"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-user" type="submit" loading={mutation.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="new-user" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} error={errors.firstName} />
          <TextField label="Last name" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} error={errors.lastName} />
        </div>
        <TextField label="Email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={errors.email} />
        <TextField label="Temporary password" type="text" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} error={errors.password} hint="Minimum 8 characters." />
        <SelectField
          label="Role"
          options={options}
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
          error={errors.role}
        />
      </form>
    </Modal>
  );
}
