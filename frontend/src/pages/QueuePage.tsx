import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Ticket, Stethoscope } from 'lucide-react';
import { apiList, apiPost } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useApiMutation } from '../api/mutations';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, Badge, CenteredSpinner, ErrorState, EmptyState } from '../components/ui/primitives';
import { fmtDateTime, fmtTime, fullName } from '../lib/format';
import type { Appointment } from '../lib/types';
import { ApiError } from '../lib/apiError';

const LANES: { key: string; title: string; tone: string }[] = [
  { key: 'BOOKED', title: 'Waiting', tone: 'text-sky-700' },
  { key: 'CHECKED_IN', title: 'Checked in', tone: 'text-indigo-700' },
  { key: 'IN_PROGRESS', title: 'In consultation', tone: 'text-amber-700' },
  { key: 'COMPLETED', title: 'Completed', tone: 'text-emerald-700' },
];

export function QueuePage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  // Day window in the user's local timezone, sent as ISO (UTC) to the API.
  const { from, to } = useMemo(() => {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59.999`);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [date]);

  const query = useQuery({
    queryKey: qk.queue(date),
    // The queue is "every appointment for the day, grouped by status". The
    // dedicated /appointments/queue endpoint only returns QueueEntry rows
    // (checked-in onward) with a different status vocabulary, so we drive off
    // the appointments list instead and keep the real appointment id + status.
    queryFn: () => apiList<Appointment>('/appointments', { from, to, limit: 100 }),
    refetchInterval: 15_000,
  });

  const action = useApiMutation<{ id: string; kind: 'check-in' | 'check-out' }>({
    mutationFn: ({ id, kind }) => apiPost(`/appointments/${id}/${kind}`),
    invalidate: [['queue'], ['appointments']],
    successMessage: 'Queue updated.',
  });

  const rows = query.data?.items ?? [];
  const visible = rows.filter((r) => !['CANCELLED', 'NO_SHOW'].includes(r.status));

  return (
    <>
      <PageHeader
        title="Live queue"
        subtitle="Real-time patient flow — auto-refreshes every 15s."
        actions={
          <>
            <input type="date" className="input w-44" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button
              variant="outline"
              icon={<RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />}
              onClick={() => query.refetch()}
            >
              Refresh
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <CenteredSpinner label="Loading queue…" />
      ) : query.error ? (
        <ErrorState message={(query.error as ApiError).message} onRetry={() => query.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title="Queue is empty" hint="No appointments for the selected day." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LANES.map((lane) => {
            const items = visible.filter((r) => r.status === lane.key);
            return (
              <div key={lane.key} className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={`text-sm font-bold ${lane.tone}`}>{lane.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="py-4 text-center text-xs text-slate-300">—</p>}
                  {items.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/patients/${a.patientId}`}
                          className="truncate text-sm font-semibold text-slate-700 hover:text-brand-700"
                        >
                          {a.patient ? fullName(a.patient) : a.patientId.slice(0, 8)}
                        </Link>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                          {a.queueEntry?.queueNumber != null && (
                            <span className="inline-flex items-center gap-0.5 font-semibold text-brand-700">
                              <Ticket className="h-3 w-3" />
                              {a.queueEntry.queueNumber}
                            </span>
                          )}
                          {fmtTime(a.scheduledAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {a.reason || fmtDateTime(a.scheduledAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.status === 'BOOKED' && (
                          <Button
                            variant="outline"
                            className="w-full px-2 py-1 text-xs"
                            loading={action.isPending}
                            onClick={() => action.mutate({ id: a.id, kind: 'check-in' })}
                          >
                            Check in
                          </Button>
                        )}
                        {a.status === 'CHECKED_IN' && (
                          <Button
                            className="flex-1 px-2 py-1 text-xs"
                            icon={<Stethoscope className="h-3.5 w-3.5" />}
                            onClick={() =>
                              navigate(
                                `/consultations?new=1&patientId=${a.patientId}&appointmentId=${a.id}`,
                              )
                            }
                          >
                            Start consultation
                          </Button>
                        )}
                        {(a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS') && (
                          <Button
                            variant="outline"
                            className="flex-1 px-2 py-1 text-xs"
                            loading={action.isPending}
                            onClick={() => action.mutate({ id: a.id, kind: 'check-out' })}
                          >
                            Check out
                          </Button>
                        )}
                        {a.status === 'COMPLETED' && <Badge value="completed" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
