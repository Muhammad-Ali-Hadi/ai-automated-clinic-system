import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Undo2, ShieldPlus } from 'lucide-react';
import { apiGet, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, Badge, CenteredSpinner, ErrorState, SectionTitle } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { TextField } from '../components/ui/Field';
import { fmtDate, fmtMoney, fullName } from '../lib/format';
import type { Invoice } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const [modal, setModal] = useState<null | 'pay' | 'refund' | 'claim'>(null);

  const query = useQuery({
    queryKey: qk.invoice(invoiceId),
    queryFn: () => apiGet<Invoice>(`/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });

  if (query.isLoading) return <CenteredSpinner label="Loading invoice…" />;
  if (query.error) return <ErrorState message={(query.error as ApiError).message} onRetry={() => query.refetch()} />;

  const inv = query.data!;
  const outstanding = Math.max(0, Number(inv.total) - Number(inv.amountPaid ?? 0));

  return (
    <>
      <Link to="/invoices" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All invoices
      </Link>

      <PageHeader
        title={`Invoice ${inv.invoiceNumber}`}
        subtitle={inv.patient ? `Billed to ${fullName(inv.patient)}` : undefined}
        actions={
          <>
            <Badge value={inv.status} />
            {inv.status === 'PENDING' && (
              <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => setModal('pay')}>
                Record payment
              </Button>
            )}
            {inv.status === 'PAID' && (
              <Button variant="outline" icon={<Undo2 className="h-4 w-4" />} onClick={() => setModal('refund')}>
                Refund
              </Button>
            )}
            <Button variant="outline" icon={<ShieldPlus className="h-4 w-4" />} onClick={() => setModal('claim')}>
              Insurance claim
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <SectionTitle>Line items</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items ?? []).map((it, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{fmtMoney(it.unitPrice)}</td>
                  <td className="py-2 text-right font-medium">
                    {fmtMoney(it.total ?? Number(it.quantity) * Number(it.unitPrice))}
                  </td>
                </tr>
              ))}
              {(inv.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400">
                    No itemised lines returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <SectionTitle>Summary</SectionTitle>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={fmtMoney(inv.subtotal ?? inv.total)} />
            <Row label="Discount" value={fmtMoney(inv.discount ?? 0)} />
            <Row label="Total" value={fmtMoney(inv.total)} bold />
            <Row label="Paid" value={fmtMoney(inv.amountPaid ?? 0)} />
            <Row label="Outstanding" value={fmtMoney(outstanding)} bold />
            <Row label="Due date" value={fmtDate(inv.dueAt)} />
            <Row label="Created" value={fmtDate(inv.createdAt)} />
          </dl>
        </div>
      </div>

      <AmountModal
        open={modal === 'pay'}
        onClose={() => setModal(null)}
        title="Record payment"
        defaultAmount={outstanding || Number(inv.total)}
        withMethod
        submit={(body) => apiPost(`/invoices/${invoiceId}/pay`, body)}
        invalidate={invoiceId}
        successMessage="Payment recorded."
      />
      <AmountModal
        open={modal === 'refund'}
        onClose={() => setModal(null)}
        title="Issue refund"
        defaultAmount={Number(inv.amountPaid ?? inv.total)}
        submit={(body) => apiPost(`/invoices/${invoiceId}/refund`, { amount: body.amount })}
        invalidate={invoiceId}
        successMessage="Refund processed."
      />
      <ClaimModal open={modal === 'claim'} onClose={() => setModal(null)} invoiceId={invoiceId} defaultAmount={Number(inv.total)} />
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className={bold ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}>{value}</dd>
    </div>
  );
}

function AmountModal({
  open,
  onClose,
  title,
  defaultAmount,
  withMethod,
  submit,
  invalidate,
  successMessage,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  defaultAmount: number;
  withMethod?: boolean;
  submit: (body: { amount: number; method?: string }) => Promise<unknown>;
  invalidate: string;
  successMessage: string;
}) {
  const [amount, setAmount] = useState(String(defaultAmount || 0));
  const [method, setMethod] = useState('CASH');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<void>({
    mutationFn: () => submit({ amount: Number(amount), method: withMethod ? method : undefined }),
    invalidate: [qk.invoice(invalidate), ['invoices']],
    successMessage,
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => mutation.mutate(undefined, { onError: (e) => e instanceof ApiError && setErrors(e.fieldMap) })}
          >
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        {withMethod && (
          <label className="block">
            <span className="label">Method</span>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {['CASH', 'CARD', 'BANK_TRANSFER', 'INSURANCE', 'MOBILE'].map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Modal>
  );
}

function ClaimModal({
  open,
  onClose,
  invoiceId,
  defaultAmount,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  defaultAmount: number;
}) {
  const [form, setForm] = useState({ provider: '', policyNumber: '', amountClaimed: String(defaultAmount) });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<void>({
    mutationFn: () =>
      apiPost(`/invoices/${invoiceId}/claims`, {
        provider: form.provider,
        policyNumber: form.policyNumber,
        amountClaimed: Number(form.amountClaimed),
      }),
    invalidate: [qk.invoice(invoiceId), ['invoices']],
    successMessage: 'Insurance claim filed.',
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="File insurance claim"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => mutation.mutate(undefined, { onError: (e) => e instanceof ApiError && setErrors(e.fieldMap) })}
          >
            File claim
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Provider" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} error={errors.provider} />
        <TextField label="Policy number" value={form.policyNumber} onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))} error={errors.policyNumber} />
        <TextField label="Amount claimed" type="number" step="0.01" value={form.amountClaimed} onChange={(e) => setForm((f) => ({ ...f, amountClaimed: e.target.value }))} error={errors.amountClaimed} />
      </div>
    </Modal>
  );
}
