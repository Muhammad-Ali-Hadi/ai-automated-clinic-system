import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users, CalendarClock, FileWarning, FlaskConical, DollarSign, HeartPulse } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import { qk } from '../api/keys';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, SectionTitle, CenteredSpinner, ErrorState } from '../components/ui/primitives';
import { fmtMoney, fmtNumber, titleCase } from '../lib/format';
import { useAuth } from '../features/auth/AuthProvider';
import { ApiError } from '../lib/apiError';

interface DashboardSummary {
  totalPatients: number;
  activePatients: number;
  todayAppointments: number;
  pendingInvoices: number;
  totalRevenue: number;
  totalLabTests: number;
}

export function DashboardPage() {
  const { user } = useAuth();

  const summary = useQuery({
    queryKey: qk.reportDashboard,
    queryFn: () => apiGet<DashboardSummary>('/reports/dashboard'),
  });

  const revenue = useQuery({
    queryKey: qk.report('revenue', { groupBy: 'day' }),
    queryFn: () => apiGet<{ period: string; invoiced: number; collected: number }[]>('/reports/revenue', { groupBy: 'day' }),
  });

  const appts = useQuery({
    queryKey: qk.report('appointments', {}),
    queryFn: () => apiGet<{ byStatus: { status: string; count: number }[] }>('/reports/appointments'),
  });

  if (summary.isLoading) return <CenteredSpinner label="Loading dashboard…" />;
  if (summary.error)
    return <ErrorState message={(summary.error as ApiError).message} onRetry={() => summary.refetch()} />;

  const s = summary.data!;

  return (
    <>
      <PageHeader
        title={`Welcome back${user?.email ? `, ${user.email.split('@')[0]}` : ''}`}
        subtitle="Headline KPIs for your hospital, live from the operational database."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total patients" value={fmtNumber(s.totalPatients)} icon={<Users className="h-5 w-5" />} tone="brand" hint={`${fmtNumber(s.activePatients)} active`} />
        <StatCard label="Appointments today" value={fmtNumber(s.todayAppointments)} icon={<CalendarClock className="h-5 w-5" />} tone="sky" />
        <StatCard label="Pending invoices" value={fmtNumber(s.pendingInvoices)} icon={<FileWarning className="h-5 w-5" />} tone="amber" />
        <StatCard label="Revenue collected" value={fmtMoney(s.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Lab tests" value={fmtNumber(s.totalLabTests)} icon={<FlaskConical className="h-5 w-5" />} tone="violet" />
        <StatCard label="Active patients" value={fmtNumber(s.activePatients)} icon={<HeartPulse className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Revenue (by day)</SectionTitle>
          {revenue.isLoading ? (
            <CenteredSpinner />
          ) : (revenue.data?.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No invoices in range yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenue.data} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Area type="monotone" dataKey="invoiced" stroke="#0d9488" fill="url(#rev)" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" stroke="#0369a1" fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <SectionTitle>Appointments by status</SectionTitle>
          {appts.isLoading ? (
            <CenteredSpinner />
          ) : (appts.data?.byStatus?.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No appointments yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={appts.data!.byStatus.map((r) => ({ ...r, status: titleCase(r.status) }))} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </>
  );
}
