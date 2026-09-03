import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, HandCoins } from 'lucide-react';
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
import { SelectField, TextField } from '../components/ui/Field';
import { usePatientOptions } from '../api/lookups';
import { fmtDate, fmtMoney, fullName } from '../lib/format';
import type { Medicine, Prescription } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function PharmacyPage() {
  const { page, search, setSearch, setPage } = useListParams();
  const [sp, setSp] = useSearchParams();
  const [term, setTerm] = useState(search);
  const debounced = useDebounced(term, 350);
  const [addOpen, setAddOpen] = useState(sp.get('new') === '1');
  const [dispenseOpen, setDispenseOpen] = useState(false);

  useEffect(() => setSearch(debounced), [debounced, setSearch]);
  useEffect(() => {
    if (sp.get('new') === '1') {
      setAddOpen(true);
      sp.delete('new');
      setSp(sp, { replace: true });
    }
  }, [sp, setSp]);

  const params = { page, limit: 15, search: search || undefined };
  const query = useQuery({
    queryKey: qk.medicines(params),
    queryFn: () => apiList<Medicine>('/medicines', params),
    placeholderData: (p) => p,
  });

  const columns: Column<Medicine>[] = [
    { key: 'name', header: 'Medicine', render: (m) => (
      <div>
        <p className="font-semibold text-slate-800">{m.name}</p>
        <p className="text-xs text-slate-400">{m.sku}{m.category ? ` · ${m.category}` : ''}</p>
      </div>
    ) },
    {
      key: 'qty',
      header: 'In stock',
      align: 'right',
      render: (m) => (
        <span className={m.quantity <= m.reorderLevel ? 'font-bold text-rose-600' : 'font-medium text-slate-700'}>
          {m.quantity}
        </span>
      ),
    },
    { key: 'reorder', header: 'Reorder at', align: 'right', render: (m) => m.reorderLevel },
    { key: 'price', header: 'Unit price', align: 'right', render: (m) => fmtMoney(m.unitPrice) },
    { key: 'expiry', header: 'Expires', render: (m) => fmtDate(m.expiresAt) },
    {
      key: 'flag',
      header: '',
      render: (m) => (m.quantity <= m.reorderLevel ? <Badge value="low stock" className="bg-rose-100 text-rose-700" /> : null),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pharmacy"
        subtitle="Formulary, stock levels and dispensing against prescriptions."
        actions={
          <>
            <SearchInput value={term} onChange={setTerm} placeholder="Medicine or SKU…" />
            <Button variant="outline" icon={<HandCoins className="h-4 w-4" />} onClick={() => setDispenseOpen(true)}>
              Dispense
            </Button>
            <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
              Add medicine
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(m) => m.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No medicines in the formulary"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <AddMedicineModal open={addOpen} onClose={() => setAddOpen(false)} />
      <DispenseModal open={dispenseOpen} onClose={() => setDispenseOpen(false)} />
    </>
  );
}

function AddMedicineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    category: '',
    sku: `SKU-${Date.now().toString().slice(-6)}`,
    quantity: '100',
    reorderLevel: '20',
    unitPrice: '5',
    expiresAt: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, sku: `SKU-${Date.now().toString().slice(-6)}` }));
  }, [open]);

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/medicines', {
        name: b.name,
        category: b.category || undefined,
        sku: b.sku,
        quantity: Number(b.quantity),
        reorderLevel: Number(b.reorderLevel),
        unitPrice: Number(b.unitPrice),
        expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : undefined,
      }),
    invalidate: [['medicines']],
    successMessage: 'Medicine added.',
    onSuccess: () => {
      setForm((f) => ({ ...f, name: '', category: '' }));
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
      title="Add medicine"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="add-med" type="submit" loading={mutation.isPending}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-med" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
          <TextField label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} error={errors.category} />
          <TextField label="SKU" required value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} error={errors.sku} />
          <TextField label="Unit price" type="number" step="0.01" required value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} error={errors.unitPrice} />
          <TextField label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} error={errors.quantity} />
          <TextField label="Reorder level" type="number" value={form.reorderLevel} onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} error={errors.reorderLevel} />
          <TextField label="Expires at" type="date" wrapClassName="col-span-2" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} error={errors.expiresAt} />
        </div>
      </form>
    </Modal>
  );
}

function DispenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const patients = usePatientOptions();
  const [patientId, setPatientId] = useState('');

  const prescriptions = useQuery({
    queryKey: qk.prescriptions({ dispense: true, patientId }),
    queryFn: () => apiList<Prescription>('/prescriptions', { limit: 50, patientId: patientId || undefined }),
    enabled: open,
  });

  const [prescriptionId, setPrescriptionId] = useState('');

  const mutation = useApiMutation<string>({
    mutationFn: (id) => apiPost(`/medicines/dispense/${id}`),
    invalidate: [['medicines'], ['dispensing'], ['prescriptions']],
    successMessage: 'Prescription dispensed and stock adjusted.',
    onSuccess: () => {
      setPrescriptionId('');
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dispense prescription"
      description="Deducts dispensed quantities from stock."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!prescriptionId} loading={mutation.isPending} onClick={() => mutation.mutate(prescriptionId)}>
            Dispense
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Filter by patient"
          placeholder="All patients"
          options={patients.options}
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            setPrescriptionId('');
          }}
        />
        <SelectField
          label="Prescription"
          required
          placeholder={prescriptions.isLoading ? 'Loading…' : 'Select a prescription'}
          options={(prescriptions.data?.items ?? []).map((rx) => ({
            value: rx.id,
            label: `${rx.medicineName} — ${rx.dosage} ${rx.frequency}${rx.patient ? ` (${fullName(rx.patient)})` : ''}`,
          }))}
          value={prescriptionId}
          onChange={(e) => setPrescriptionId(e.target.value)}
        />
        {(prescriptions.data?.items.length ?? 0) === 0 && !prescriptions.isLoading && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No prescriptions found. Issue one under <b>Prescriptions</b> first.
          </p>
        )}
      </div>
    </Modal>
  );
}
