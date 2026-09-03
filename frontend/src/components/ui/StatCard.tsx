import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function StatCard({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'sky' | 'amber' | 'rose' | 'emerald' | 'violet';
  hint?: string;
  loading?: boolean;
}) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];

  return (
    <div className="card flex items-center gap-4 p-4">
      {icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', toneClass)}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {loading ? (
          <div className="skeleton mt-1 h-6 w-16" />
        ) : (
          <p className="text-xl font-bold text-slate-800">{value}</p>
        )}
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
