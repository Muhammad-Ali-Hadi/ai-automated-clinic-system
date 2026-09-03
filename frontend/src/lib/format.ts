import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

export function fmtDate(value?: string | Date | null, pattern = 'dd MMM yyyy'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? format(d, pattern) : '—';
}

export function fmtDateTime(value?: string | Date | null): string {
  return fmtDate(value, 'dd MMM yyyy, HH:mm');
}

export function fmtTime(value?: string | Date | null): string {
  return fmtDate(value, 'HH:mm');
}

export function fmtRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function fmtMoney(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? currency.format(n) : '—';
}

export function fmtNumber(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US').format(n) : '—';
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? '').charAt(0)}${(last ?? '').charAt(0)}`.toUpperCase() || '?';
}

export function fullName(p?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!p) return '—';
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';
}

export function titleCase(s?: string | null): string {
  if (!s) return '—';
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** age in years from an ISO date string */
export function ageFrom(dob?: string | null): string {
  if (!dob) return '—';
  const d = parseISO(dob);
  if (!isValid(d)) return '—';
  const diff = Date.now() - d.getTime();
  return `${Math.abs(new Date(diff).getUTCFullYear() - 1970)}y`;
}
