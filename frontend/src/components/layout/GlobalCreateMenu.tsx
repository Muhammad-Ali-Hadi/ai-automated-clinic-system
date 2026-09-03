import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import type { Role } from '../../lib/types';

interface Shortcut {
  label: string;
  to: string;
  roles: Role[];
}

const SHORTCUTS: Shortcut[] = [
  { label: 'Register patient', to: '/patients?new=1', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'] },
  { label: 'Book appointment', to: '/appointments?new=1', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { label: 'New consultation', to: '/consultations?new=1', roles: ['HOSPITAL_ADMIN', 'DOCTOR'] },
  { label: 'New prescription', to: '/prescriptions?new=1', roles: ['HOSPITAL_ADMIN', 'DOCTOR'] },
  { label: 'Order lab test', to: '/lab-tests?new=1', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
  { label: 'Add medicine', to: '/pharmacy?new=1', roles: ['HOSPITAL_ADMIN', 'PHARMACIST'] },
  { label: 'Create invoice', to: '/invoices?new=1', roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT'] },
];

export function GlobalCreateMenu({ trigger }: { trigger: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const available = SHORTCUTS.filter((s) => (user ? s.roles.includes(user.role) : false));
  if (available.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 animate-fade-in overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {available.map((s) => (
            <button
              key={s.to}
              onClick={() => {
                setOpen(false);
                navigate(s.to);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-800"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
