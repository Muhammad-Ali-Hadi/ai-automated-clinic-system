import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiList, apiPost } from '../../lib/apiClient';
import { useApiMutation } from '../../api/mutations';
import { Button, CenteredSpinner, EmptyState, SectionTitle } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { ApiError } from '../../lib/apiError';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface Props<T> {
  patientId: string;
  sub: string;
  title: string;
  /** endpoint segment, e.g. "allergies" */
  path: string;
  columns: { header: string; render: (row: T) => ReactNode }[];
  addFields: FieldDef[];
  rowKey: (row: T) => string;
  /** some sub-resources are not paginated */
  list?: boolean;
  deletable?: boolean;
  transform?: (raw: Record<string, unknown>) => Record<string, unknown>;
}

export function SubResource<T extends Record<string, unknown>>({
  patientId,
  sub,
  title,
  path,
  columns,
  addFields,
  rowKey,
  list = true,
  deletable = true,
  transform,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const url = `/patients/${patientId}/${path}`;

  const query = useQuery({
    queryKey: ['patient', patientId, sub],
    queryFn: async () => {
      if (list) return (await apiList<T>(url, { limit: 50 })).items;
      const data = await apiGet<T[] | { data: T[] }>(url);
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
  });

  const rows = query.data ?? [];

  const del = useApiMutation<string>({
    mutationFn: (id) => apiDelete(`${url}/${id}`),
    invalidate: [['patient', patientId, sub], ['patient', patientId, 'timeline']],
    successMessage: `${title} entry removed.`,
  });

  return (
    <div className="card p-5">
      <SectionTitle
        action={
          <Button variant="outline" className="px-2.5 py-1" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
            Add
          </Button>
        }
      >
        {title}
      </SectionTitle>

      {query.isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()}`} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={rowKey(row)} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {columns.map((c, i) => (
                  <span key={i} className={i === 0 ? 'font-semibold text-slate-700' : 'text-slate-500'}>
                    {c.render(row)}
                  </span>
                ))}
              </div>
              {deletable && (
                <button
                  onClick={() => del.mutate(rowKey(row))}
                  className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Add ${title.toLowerCase()}`}
        fields={addFields}
        postUrl={url}
        invalidateKeys={[['patient', patientId, sub], ['patient', patientId, 'timeline']]}
        transform={transform}
      />
    </div>
  );
}

function AddModal({
  open,
  onClose,
  title,
  fields,
  postUrl,
  invalidateKeys,
  transform,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FieldDef[];
  postUrl: string;
  invalidateKeys: (readonly unknown[])[];
  transform?: (raw: Record<string, unknown>) => Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation<Record<string, string>>({
    mutationFn: (raw) => {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        const v = raw[f.name];
        if (v === undefined || v === '') continue;
        body[f.name] = f.type === 'number' ? Number(v) : v;
      }
      return apiPost(postUrl, transform ? transform(body) : body);
    },
    invalidate: invalidateKeys as never,
    successMessage: 'Saved.',
    onSuccess: () => {
      setValues({});
      onClose();
    },
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
            onClick={() =>
              mutation.mutate(values, {
                onError: (err) => err instanceof ApiError && setErrors(err.fieldMap),
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="label">
              {f.label}
              {f.required && <span className="text-rose-500"> *</span>}
            </span>
            {f.type === 'select' ? (
              <select
                className="input"
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              >
                <option value="">{f.placeholder ?? 'Select…'}</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                className="input resize-y"
                rows={3}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                type={f.type ?? 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
            {errors[f.name] && <span className="mt-1 block text-xs text-rose-600">{errors[f.name]}</span>}
          </label>
        ))}
      </div>
    </Modal>
  );
}
