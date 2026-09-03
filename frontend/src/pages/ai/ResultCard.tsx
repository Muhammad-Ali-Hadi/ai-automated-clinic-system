import { useState } from 'react';
import { Sparkles, Clock, Cpu, ChevronDown } from 'lucide-react';
import type { AiResult } from '../../api/ai';
import { primaryText } from '../../api/ai';

export function ResultCard({ result }: { result: AiResult | undefined }) {
  const [rawOpen, setRawOpen] = useState(false);
  if (!result) return null;

  const text = primaryText(result);
  const extraKeys = Object.keys(result).filter(
    (k) => !['content', 'answer', 'responseMessage', 'summary', 'transcript', 'text', 'usage', 'latencyMs', 'model', 'provider', 'requestId'].includes(k),
  );

  return (
    <div className="card mt-4 animate-fade-in p-5">
      <div className="mb-3 flex items-center gap-2 text-brand-700">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-bold uppercase tracking-wide">AI output</span>
        <span className="ml-auto flex items-center gap-3 text-xs font-normal text-slate-400">
          {result.model && (
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {result.model}
            </span>
          )}
          {typeof result.latencyMs === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {result.latencyMs} ms
            </span>
          )}
          {result.usage?.totalTokens ? <span>{result.usage.totalTokens} tok</span> : null}
        </span>
      </div>

      {text ? (
        <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
          {text}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No text field in the response — see raw output below.</p>
      )}

      {extraKeys.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {extraKeys.map((k) => {
            const v = (result as Record<string, unknown>)[k];
            if (v === null || v === undefined || typeof v === 'object') return null;
            return (
              <span key={k} className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">
                {k}: {String(v)}
              </span>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setRawOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${rawOpen ? 'rotate-180' : ''}`} />
        Raw response
      </button>
      {rawOpen && (
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
