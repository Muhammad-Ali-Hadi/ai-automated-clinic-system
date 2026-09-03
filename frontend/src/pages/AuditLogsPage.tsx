import { useQuery } from '@tanstack/react-query';
import { apiList } from '../lib/apiClient';
import { qk } from '../api/keys';
import { useListParams } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { SearchInput } from '../components/ui/SearchInput';
import { Badge } from '../components/ui/primitives';
import { fmtDateTime } from '../lib/format';
import type { AuditLogRow } from '../lib/types';
import { ApiError } from '../lib/apiError';

export function AuditLogsPage() {
  const { page, get, patch, setPage } = useListParams();
  const action = get('action');

  const params = { page, limit: 50, action: action || undefined };
  const query = useQuery({
    queryKey: qk.auditLogs(params),
    queryFn: () => apiList<AuditLogRow>('/audit-logs', params),
    placeholderData: (p) => p,
  });

  const columns: Column<AuditLogRow>[] = [
    { key: 'when', header: 'Timestamp', render: (r) => fmtDateTime(r.createdAt) },
    { key: 'action', header: 'Action', render: (r) => <Badge value={r.action} /> },
    { key: 'entity', header: 'Resource', render: (r) => `${r.entityType ?? '—'}${r.entityId ? ` · ${String(r.entityId).slice(0, 8)}` : ''}` },
    { key: 'actor', header: 'Actor', render: (r) => (r.userId ? String(r.userId).slice(0, 8) : 'system') },
    {
      key: 'meta',
      header: 'Detail',
      render: (r) =>
        r.metadata ? (
          <code className="text-xs text-slate-500">{JSON.stringify(r.metadata).slice(0, 80)}</code>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit logs"
        subtitle="Immutable trail of every mutating action in your tenant."
        actions={
          <SearchInput
            value={action}
            onChange={(v) => patch({ action: v || undefined })}
            placeholder="Filter by action…"
          />
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No audit entries"
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
    </>
  );
}
