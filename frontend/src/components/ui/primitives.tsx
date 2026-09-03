import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

/* ─────────────────────────── Button ─────────────────────────── */

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(variantClass[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ─────────────────────────── Badge ─────────────────────────── */

const STATUS_TONE: Record<string, string> = {
  // generic
  active: 'bg-emerald-100 text-emerald-700',
  ok: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-emerald-100 text-emerald-700',
  // in-progress / neutral
  booked: 'bg-sky-100 text-sky-700',
  checked_in: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  processing: 'bg-amber-100 text-amber-700',
  collected: 'bg-indigo-100 text-indigo-700',
  requested: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  queued: 'bg-amber-100 text-amber-700',
  // bad
  cancelled: 'bg-slate-200 text-slate-600',
  no_show: 'bg-rose-100 text-rose-700',
  failed: 'bg-rose-100 text-rose-700',
  refunded: 'bg-fuchsia-100 text-fuchsia-700',
  rejected: 'bg-rose-100 text-rose-700',
  archived: 'bg-slate-200 text-slate-600',
  deceased: 'bg-slate-800 text-white',
};

export function Badge({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const key = value.toLowerCase();
  const tone = STATUS_TONE[key] ?? 'bg-slate-100 text-slate-600';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
        tone,
        className,
      )}
    >
      {value.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

/* ─────────────────────────── Card ─────────────────────────── */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card p-5', className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{children}</h3>
      {action}
    </div>
  );
}

/* ─────────────────────────── Spinner / states ─────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
      <Spinner className="h-6 w-6" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-12 text-center">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-200 bg-rose-50 py-10 text-center">
      <p className="max-w-md text-sm font-medium text-rose-700">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-6 flex-1" style={{ opacity: 1 - r * 0.12 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
