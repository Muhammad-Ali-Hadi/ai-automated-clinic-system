import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { CenteredSpinner } from '../../components/ui/primitives';
import type { Role } from '../../lib/types';

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid h-full place-items-center">
        <CenteredSpinner label="Restoring session…" />
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && user.role !== 'SUPER_ADMIN' && !roles.includes(user.role)) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-lg font-bold text-slate-700">Access restricted</p>
          <p className="mt-1 text-sm text-slate-500">
            Your role ({user.role.replace(/_/g, ' ').toLowerCase()}) can’t open this screen.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
