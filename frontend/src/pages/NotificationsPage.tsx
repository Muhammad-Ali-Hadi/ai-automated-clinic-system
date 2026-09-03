import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
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
import { fmtDateTime, fullName } from '../lib/format';
import type { NotificationRow, UserRow } from '../lib/types';
import { ApiError } from '../lib/apiError';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

export function NotificationsPage() {
  const { page, get, patch, setPage } = useListParams();
  const [open, setOpen] = useState(false);
  const channel = get('channel');

  const params = { page, limit: 20, channel: channel || undefined };
  const query = useQuery({
    queryKey: qk.notifications(params),
    queryFn: () => apiList<NotificationRow>('/notifications', params),
    placeholderData: (p) => p,
  });

  const columns: Column<NotificationRow>[] = [
    { key: 'channel', header: 'Channel', render: (n) => <Badge value={n.channel} /> },
    { key: 'subject', header: 'Title', render: (n) => <span className="font-medium">{n.subject || n.body?.slice(0, 40) || '—'}</span> },
    { key: 'recipient', header: 'Recipient', render: (n) => n.recipient || '—' },
    { key: 'status', header: 'Status', render: (n) => <Badge value={n.status} /> },
    { key: 'created', header: 'Created', render: (n) => fmtDateTime(n.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Outbound messages queued through the notification engine."
        actions={
          <>
            <SelectField
              wrapClassName="w-40"
              value={channel}
              onChange={(e) => patch({ channel: e.target.value || undefined })}
              options={[{ value: '', label: 'All channels' }, ...CHANNELS.map((c) => ({ value: c, label: c }))]}
            />
            <Button icon={<Send className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Send notification
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(n) => n.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error ? (query.error as ApiError).message : null}
        onRetry={() => query.refetch()}
        emptyTitle="No notifications"
        emptyHint="Email is delivered when SMTP is configured; other channels queue for provider setup."
      />
      {query.data && (
        <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />
      )}
      <SendModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const users = useQuery({
    queryKey: qk.users({ picker: 'notify' }),
    queryFn: () => apiList<UserRow>('/auth/users', { limit: 100 }),
    enabled: open,
  });

  const [form, setForm] = useState({ userId: '', channel: 'EMAIL', title: '', body: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<typeof form>({
    mutationFn: (b) => apiPost('/notifications', b),
    invalidate: [['notifications']],
    successMessage: 'Notification queued.',
    onSuccess: () => {
      setForm((f) => ({ ...f, title: '', body: '' }));
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
      title="Send notification"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="send-notif" type="submit" loading={mutation.isPending}>
            Send
          </Button>
        </>
      }
    >
      <form id="send-notif" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Recipient"
            required
            placeholder={users.isLoading ? 'Loading…' : 'Select user'}
            options={(users.data?.items ?? []).map((u) => ({ value: u.id, label: `${fullName(u)} · ${u.email}` }))}
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            error={errors.userId}
          />
          <SelectField
            label="Channel"
            options={CHANNELS.map((c) => ({ value: c, label: c }))}
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            error={errors.channel}
          />
        </div>
        <TextField label="Title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} />
        <TextAreaField label="Message" required rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} error={errors.body} />
      </form>
    </Modal>
  );
}
