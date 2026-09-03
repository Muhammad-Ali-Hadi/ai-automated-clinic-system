import { useEffect, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { useApiMutation } from '../../api/mutations';
import { Button } from '../../components/ui/primitives';
import { TextField, TextAreaField, SelectField } from '../../components/ui/Field';
import { ApiError } from '../../lib/apiError';
import type { AiResult } from '../../api/ai';
import type { FormTool } from './toolConfig';
import { ResultCard } from './ResultCard';

export function FormToolPanel({ tool }: { tool: FormTool }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AiResult>();

  useEffect(() => {
    setValues({});
    setErrors({});
    setResult(undefined);
  }, [tool.id]);

  const mutation = useApiMutation<Record<string, string>, AiResult>({
    mutationFn: (body) => tool.submit(body),
    onSuccess: (data) => setResult(data),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const body: Record<string, string> = {};
    for (const f of tool.fields) {
      const v = values[f.name]?.trim();
      if (v) body[f.name] = v;
    }
    mutation.mutate(body, { onError: (err) => err instanceof ApiError && setErrors(err.fieldMap) });
  }

  const set = (name: string) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">{tool.title}</h2>
        <p className="text-sm text-slate-500">{tool.description}</p>
      </div>

      <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
        {tool.fields.map((f) => {
          const common = {
            label: f.label,
            required: f.required,
            error: errors[f.name],
            value: values[f.name] ?? '',
            onChange: set(f.name),
            wrapClassName: f.full ? 'sm:col-span-2' : undefined,
          };
          if (f.type === 'textarea')
            return <TextAreaField key={f.name} rows={f.rows ?? 3} placeholder={f.placeholder} {...common} />;
          if (f.type === 'select')
            return (
              <SelectField
                key={f.name}
                options={f.options ?? []}
                placeholder="Default"
                {...common}
              />
            );
          return <TextField key={f.name} type={f.type ?? 'text'} placeholder={f.placeholder} {...common} />;
        })}

        <div className="sm:col-span-2">
          <Button type="submit" loading={mutation.isPending} icon={<Sparkles className="h-4 w-4" />}>
            Run
          </Button>
        </div>
      </form>

      <ResultCard result={result} />
    </div>
  );
}
