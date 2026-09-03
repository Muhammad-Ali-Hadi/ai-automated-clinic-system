import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Beaker, CheckCircle2, XCircle } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button, Badge } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { usePatientOptions } from '../api/lookups';
import { fmtDateTime, fullName } from '../lib/format';
import type { LabTest } from '../lib/types';
import { ApiError } from '../lib/apiError';

const STATUSES = ['REQUESTED', 'COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

export function LabTestsPage() {
  const { page, get, patch, setPage } = useListParams();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get('new') === '1');
  const [resultFor, setResultFor] = useState<LabTest | null>(null);
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
    queryKey: qk.labTests(params),
    queryFn: () => apiList<LabTest>('/lab-tests', params),
    placeholderData: (p) => p,
  });

  const step = useApiMutation<{ id: string; kind: 'collect' | 'process' | 'approve' | 'cancel' }>({
    mutationFn: ({ id, kind }) => apiPost(`/lab-tests/${id}/${kind}`),
    invalidate: [['labTests']],
    successMessage: 'Lab test updated.',
  });

  const columns: Column<LabTest>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (t) =>
        t.patient ? (
          <Link to={`/patients/${t.patientId}`} className="font-semibold text-brand-700 hover:underline">
            {fullName(t.patient)}
          </Link>
        ) : (
          <span className="font-mono text-xs text-slate-400">{t.patientId.slice(0, 8)}</span>
        ),
    },
    { key: 'test', header: 'Test', render: (t) => <span className="font-medium">{t.testName}</span> },
    { key: 'result', header: 'Result', render: (t) => t.result || '—' },
    { key: 'status', header: 'Status', render: (t) => <Badge value={t.status} /> },
    { key: 'created', header: 'Requested', render: (t) => fmtDateTime(t.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          {t.status === 'REQUESTED' && (
            <Button variant="outline" className="px-2 py-1 text-xs" loading={step.isPending} onClick={() => step.mutate({ id: t.id, kind: 'collect' })}>
              Collect
            </Button>
          )}
          {t.status === 'COLLECTED' && (
            <Button variant="outline" className="px-2 py-1 text-xs" icon={<Beaker className="h-3.5 w-3.5" />} loading={step.isPending} onClick={() => step.mutate({ id: t.id, kind: 'process' })}>
              Process
            </Button>
          )}
          {t.status === 'PROCESSING' && (
            <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => setResultFor(t)}>
              Record result
            </Button>
          )}
          {t.status === 'COMPLETED' && (
            <Button variant="outline" className="px-2 py-1 text-xs" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={step.isPending} onClick={() => step.mutate({ id: t.id, kind: 'approve' })}>
              Approve
            </Button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(t.status) && (
            <Button variant="ghost" className="px-2 py-1 text-xs text-rose-600" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => step.mutate({ id: t.id, kind: 'cancel' })}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Laboratory"
        subtitle="Order tests and move samples through collection, processing, result and approval."
        actions={
          <>
            <SelectField
              wrapClassName="w-44"
              value={status}
              onChange={(e) => patch({ status: e.target.value || undefined })}
              options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
            />
            <Button icon={<FlaskConical className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Order test
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(t) => t.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No lab tests"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <OrderModal open={open} onClose={() => setOpen(false)} />
      <ResultModal test={resultFor} onClose={() => setResultFor(null)} />
    </>
  );
}

function OrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const patients = usePatientOptions();
  const [form, setForm] = useState({ patientId: '', testName: '', referenceRange: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost('/lab-tests', {
        patientId: b.patientId,
        testName: b.testName,
        referenceRange: b.referenceRange || undefined,
      }),
    invalidate: [['labTests']],
    successMessage: 'Lab test ordered.',
    onSuccess: () => {
      setForm({ patientId: '', testName: '', referenceRange: '' });
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
      title="Order lab test"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="order-lab" type="submit" loading={mutation.isPending}>
            Order
          </Button>
        </>
      }
    >
      <form id="order-lab" onSubmit={submit} className="space-y-4">
        <SelectField
          label="Patient"
          required
          placeholder="Select patient"
          options={patients.options}
          value={form.patientId}
          onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
          error={errors.patientId}
        />
        <TextField
          label="Test name"
          required
          placeholder="e.g. Complete Blood Count"
          value={form.testName}
          onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))}
          error={errors.testName}
        />
        <TextField
          label="Reference range"
          placeholder="Optional"
          value={form.referenceRange}
          onChange={(e) => setForm((f) => ({ ...f, referenceRange: e.target.value }))}
          error={errors.referenceRange}
        />
      </form>
    </Modal>
  );
}

function ResultModal({ test, onClose }: { test: LabTest | null; onClose: () => void }) {
  const [form, setForm] = useState({ result: '', referenceRange: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (test) setForm({ result: '', referenceRange: test.referenceRange ?? '' });
  }, [test]);

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) =>
      apiPost(`/lab-tests/${test!.id}/result`, {
        result: b.result,
        referenceRange: b.referenceRange || undefined,
      }),
    invalidate: [['labTests']],
    successMessage: 'Result recorded.',
    onSuccess: onClose,
  });

  return (
    <Modal
      open={!!test}
      onClose={onClose}
      title={`Record result — ${test?.testName ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => mutation.mutate(form, { onError: (err) => err instanceof ApiError && setErrors(err.fieldMap) })}
          >
            Save result
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField
          label="Result"
          required
          rows={4}
          value={form.result}
          onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
          error={errors.result}
        />
        <TextField
          label="Reference range"
          value={form.referenceRange}
          onChange={(e) => setForm((f) => ({ ...f, referenceRange: e.target.value }))}
          error={errors.referenceRange}
        />
      </div>
    </Modal>
  );
}
