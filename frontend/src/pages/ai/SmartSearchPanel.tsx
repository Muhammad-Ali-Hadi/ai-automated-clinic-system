import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { aiApi } from '../../api/ai';
import type { AiResult } from '../../api/ai';
import { useApiMutation } from '../../api/mutations';
import { Button } from '../../components/ui/primitives';
import { ResultCard } from './ResultCard';

export function SmartSearchPanel() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<AiResult>();

  const run = useApiMutation<void, AiResult>({
    mutationFn: () => aiApi.smartSearch({ naturalLanguageQuery: q }),
    onSuccess: setResult,
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Smart search</h2>
        <p className="text-sm text-slate-500">
          Turn a plain-English request into a structured query (entity, filters, intent).
        </p>
      </div>
      <div className="card space-y-3 p-5">
        <textarea
          className="input resize-y"
          rows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Show me diabetic patients over 60 with an appointment next week"
        />
        <Button icon={<Wand2 className="h-4 w-4" />} loading={run.isPending} disabled={q.trim().length < 3} onClick={() => run.mutate()}>
          Parse query
        </Button>
      </div>
      <ResultCard result={result} />
    </div>
  );
}
