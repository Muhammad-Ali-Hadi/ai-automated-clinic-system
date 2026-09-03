import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiGet } from '../lib/apiClient';
import { qk } from '../api/keys';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CenteredSpinner, ErrorState, EmptyState } from '../components/ui/primitives';
import { fmtMoney, titleCase } from '../lib/format';
import { useAuth } from '../features/auth/AuthProvider';
import { ApiError } from '../lib/apiError';

type ReportKey = 'revenue' | 'appointments' | 'patients' | 'doctors' | 'laboratory' | 'pharmacy';

const TABS: { key: ReportKey; label: string; roles?: string[] }[] = [
  { key: 'revenue', label: 'Revenue', roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT'] },
  { key: 'appointments', label: 'Appointments' },
  { key: 'patients', label: 'Patient growth', roles: ['HOSPITAL_ADMIN'] },
  { key: 'doctors', label: 'Doctor performance', roles: ['HOSPITAL_ADMIN'] },
  { key: 'laboratory', label: 'Laboratory' },
  { key: 'pharmacy', label: 'Pharmacy', roles: ['HOSPITAL_ADMIN'] },
];

export function ReportsPage() {
  const { user } = useAuth();
  const visible = TABS.filter((t) => !t.roles || user?.role === 'SUPER_ADMIN' || t.roles.includes(user?.role ?? ''));
  const [tab, setTab] = useState<ReportKey>(visible[0]?.key ?? 'appointments');

  const query = useQuery({
    queryKey: qk.report(tab, {}),
    queryFn: () => apiGet<unknown>(`/reports/${tab}`),
  });

  return (
    <>
      <PageHeader title="Reports" subtitle="Operational and financial analytics for your hospital." />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <CenteredSpinner label="Crunching numbers…" />
      ) : query.error ? (
        <ErrorState message={(query.error as ApiError).message} onRetry={() => query.refetch()} />
      ) : (
        <ReportView tab={tab} data={query.data} />
      )}
    </>
  );
}

function ReportView({ tab, data }: { tab: ReportKey; data: unknown }) {
  if (tab === 'revenue') {
    const rows = (data as { period: string; invoiced: number; collected: number; refunded: number }[]) ?? [];
    if (rows.length === 0) return <EmptyState title="No revenue data" hint="Create and pay invoices to populate this report." />;
    return (
      <Card>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={rows} margin={{ left: -8, right: 12, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip formatter={(v: number) => fmtMoney(v)} />
            <Line type="monotone" dataKey="invoiced" stroke="#0d9488" strokeWidth={2} />
            <Line type="monotone" dataKey="collected" stroke="#0369a1" strokeWidth={2} />
            <Line type="monotone" dataKey="refunded" stroke="#e11d48" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (tab === 'patients') {
    const rows = (data as { period: string; count: number }[]) ?? [];
    if (rows.length === 0) return <EmptyState title="No registrations in range" />;
    return (
      <Card>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows} margin={{ left: -18, right: 12, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (tab === 'appointments') {
    const d = (data as { byStatus?: { status: string; count: number }[]; topDoctors?: { doctorId: string; count: number }[] }) ?? {};
    const byStatus = (d.byStatus ?? []).map((r) => ({ ...r, status: titleCase(r.status) }));
    if (byStatus.length === 0) return <EmptyState title="No appointment data" />;
    return (
      <Card>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={byStatus} margin={{ left: -18, right: 12, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (tab === 'laboratory') {
    const rows = (Array.isArray(data) ? data : (data as { byStatus?: unknown[] })?.byStatus ?? []) as {
      status: string;
      count: number;
    }[];
    if (rows.length === 0) return <EmptyState title="No lab data" />;
    return (
      <Card>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows.map((r) => ({ ...r, status: titleCase(r.status) }))} margin={{ left: -18, right: 12, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (tab === 'doctors') {
    const rows = (data as { doctorId: string; consultations: number }[]) ?? [];
    if (rows.length === 0) return <EmptyState title="No consultations recorded" />;
    return (
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2">Doctor</th>
              <th className="py-2 text-right">Consultations</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.doctorId} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-mono text-xs">{r.doctorId.slice(0, 12)}…</td>
                <td className="py-2 text-right font-semibold">{r.consultations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  // pharmacy or any other shape — show the payload
  return (
    <Card>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
