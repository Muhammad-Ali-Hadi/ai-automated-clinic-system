import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { SelectField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { usePatientOptions } from '../api/lookups';
import { fmtDate, fmtMoney, fullName } from '../lib/format';
import type { Invoice } from '../lib/types';
import { ApiError } from '../lib/apiError';

const STATUSES = ['PENDING', 'PAID', 'REFUNDED', 'FAILED'];

export function InvoicesPage() {
  const navigate = useNavigate();
  const { page, get, patch, setPage } = useListParams();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get('new') === '1');
  const status = get('status');

  useEffect(() => {
    if (sp.get('new') === '1') {
      setOpen(true);
      sp.delete('new');
      setSp(sp, { replace: true });
    }
  }, [sp, setSp]);

  const params = { page, limit: 15, status: status || undefined };
  const query = useQuery({
    queryKey: qk.invoices(params),
    queryFn: () => apiList<Invoice>('/invoices', params),
    placeholderData: (p) => p,
  });

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice', render: (i) => <span className="font-mono text-xs font-semibold">{i.invoiceNumber}</span> },
    { key: 'patient', header: 'Patient', render: (i) => (i.patient ? fullName(i.patient) : i.patientId.slice(0, 8)) },
    { key: 'total', header: 'Total', align: 'right', render: (i) => <span className="font-semibold">{fmtMoney(i.total)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', render: (i) => fmtMoney(i.amountPaid ?? 0) },
    { key: 'status', header: 'Status', render: (i) => <Badge value={i.status} /> },
    { key: 'due', header: 'Due', render: (i) => fmtDate(i.dueAt) },
  ];

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Generate invoices, collect payments, issue refunds and file insurance claims."
        actions={
          <>
            <SelectField
              wrapClassName="w-40"
              value={status}
              onChange={(e) => patch({ status: e.target.value || undefined })}
              options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
            />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Create invoice
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
        onRowClick={(i) => navigate(`/invoices/${i.id}`)}
        emptyTitle="No invoices"
        emptyHint="Create an invoice to bill a patient."
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <CreateInvoiceModal open={open} onClose={() => setOpen(false)} onCreated={(id) => navigate(`/invoices/${id}`)} />
    </>
  );
}

interface Line {
  name: string;
  quantity: string;
  unitPrice: string;
}

function CreateInvoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const patients = usePatientOptions();
  const [patientId, setPatientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [discount, setDiscount] = useState('0');
  const [lines, setLines] = useState<Line[]>([{ name: 'Consultation fee', quantity: '1', unitPrice: '50' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setInvoiceNumber(`INV-${Date.now().toString().slice(-8)}`);
      setLines([{ name: 'Consultation fee', quantity: '1', unitPrice: '50' }]);
      setDiscount('0');
      setErrors({});
    }
  }, [open]);

  const total = useMemo(() => {
    const sub = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
    return Math.max(0, sub - Number(discount || 0));
  }, [lines, discount]);

  const mutation = useApiMutation<void, Invoice>({
    mutationFn: () =>
      apiPost<Invoice>('/invoices', {
        patientId,
        invoiceNumber,
        discount: Number(discount) || undefined,
        items: lines.map((l) => ({
          name: l.name,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
      }),
    invalidate: [['invoices']],
    successMessage: 'Invoice created.',
    onSuccess: (inv) => {
      onClose();
      if (inv?.id) onCreated(inv.id);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    mutation.mutate(undefined, { onError: (err) => err instanceof ApiError && setErrors(err.fieldMap) });
  }

  const setLine = (idx: number, key: keyof Line, value: string) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create invoice"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-invoice" type="submit" loading={mutation.isPending}>
            Create · {fmtMoney(total)}
          </Button>
        </>
      }
    >
      <form id="new-invoice" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Patient"
            required
            placeholder="Select patient"
            options={patients.options}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            error={errors.patientId}
          />
          <TextField label="Invoice number" required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} error={errors.invoiceNumber} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label mb-0">Line items</span>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:underline"
              onClick={() => setLines((ls) => [...ls, { name: '', quantity: '1', unitPrice: '0' }])}
            >
              + Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input className="input flex-1" placeholder="Description" value={l.name} onChange={(e) => setLine(idx, 'name', e.target.value)} />
                <input className="input w-20" type="number" min="1" value={l.quantity} onChange={(e) => setLine(idx, 'quantity', e.target.value)} />
                <input className="input w-28" type="number" step="0.01" value={l.unitPrice} onChange={(e) => setLine(idx, 'unitPrice', e.target.value)} />
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {errors.items && <p className="mt-1 text-xs text-rose-600">{errors.items}</p>}
        </div>

        <div className="flex items-end justify-between">
          <TextField label="Discount" type="number" step="0.01" wrapClassName="w-40" value={discount} onChange={(e) => setDiscount(e.target.value)} error={errors.discount} />
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
            <p className="text-xl font-bold text-slate-800">{fmtMoney(total)}</p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
