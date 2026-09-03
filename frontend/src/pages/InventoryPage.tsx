import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiList, apiPatch, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextField } from '../components/ui/Field';
import type { InventoryItem } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function InventoryPage() {
  const { page, get, patch, setPage } = useListParams();
  const [open, setOpen] = useState(false);
  const type = get('type');

  const params = { page, limit: 20, type: type || undefined };
  const query = useQuery({
    queryKey: qk.inventory(params),
    queryFn: () => apiList<InventoryItem>('/inventory', params),
    placeholderData: (p) => p,
  });

  const adjust = useApiMutation<{ id: string; quantity: number }>({
    mutationFn: ({ id, quantity }) => apiPatch(`/inventory/${id}`, { quantity }),
    invalidate: [['inventory']],
    successMessage: 'Quantity updated.',
  });

  const columns: Column<InventoryItem>[] = [
    { key: 'name', header: 'Item', render: (i) => <span className="font-semibold text-slate-800">{i.name}</span> },
    { key: 'type', header: 'Type', render: (i) => <Badge value={i.type ?? '—'} /> },
    {
      key: 'qty',
      header: 'Quantity',
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="btn-outline h-7 w-7 p-0"
            onClick={() => adjust.mutate({ id: i.id, quantity: Math.max(0, i.quantity - 1) })}
          >
            −
          </button>
          <span className={`w-10 text-center font-semibold ${i.reorderLevel && i.quantity <= i.reorderLevel ? 'text-rose-600' : ''}`}>
            {i.quantity}
          </span>
          <button className="btn-outline h-7 w-7 p-0" onClick={() => adjust.mutate({ id: i.id, quantity: i.quantity + 1 })}>
            +
          </button>
        </div>
      ),
    },
    { key: 'reorder', header: 'Reorder at', align: 'right', render: (i) => i.reorderLevel ?? '—' },
    { key: 'status', header: 'Status', render: (i) => <Badge value={i.status ?? 'active'} /> },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Equipment and consumables — stock levels and reorder thresholds."
        actions={
          <>
            <SelectField
              wrapClassName="w-44"
              value={type}
              onChange={(e) => patch({ type: e.target.value || undefined })}
              options={[
                { value: '', label: 'All types' },
                { value: 'EQUIPMENT', label: 'Equipment' },
                { value: 'CONSUMABLE', label: 'Consumable' },
              ]}
            />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Add item
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(i) => i.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No inventory items"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <AddModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    type: 'CONSUMABLE',
    quantity: '50',
    reorderLevel: '10',
    location: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/inventory', {
        name: b.name,
        type: b.type,
        quantity: Number(b.quantity),
        reorderLevel: Number(b.reorderLevel),
        location: b.location || undefined,
      }),
    invalidate: [['inventory']],
    successMessage: 'Inventory item added.',
    onSuccess: () => {
      setForm((f) => ({ ...f, name: '', location: '' }));
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
      title="Add inventory item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-inv" type="submit" loading={mutation.isPending}>
            Add
          </Button>
        </>
      }
    >
      <form id="new-inv" onSubmit={submit} className="space-y-4">
        <TextField label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Type"
            options={[
              { value: 'CONSUMABLE', label: 'Consumable' },
              { value: 'EQUIPMENT', label: 'Equipment' },
            ]}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            error={errors.type}
          />
          <TextField label="Location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} error={errors.location} />
          <TextField label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} error={errors.quantity} />
          <TextField label="Reorder level" type="number" value={form.reorderLevel} onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} error={errors.reorderLevel} />
        </div>
      </form>
    </Modal>
  );
}
