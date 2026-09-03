import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { TextField } from '../components/ui/Field';
import { Button } from '../components/ui/primitives';
import { ApiError } from '../lib/apiError';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('admin@renovia.demo');
  const [password, setPassword] = useState('Passw0rd!23');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold">Renovia Hospital OS</p>
            <p className="text-sm text-brand-100">AI-powered hospital management</p>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            One operating system for every department.
          </h1>
          <p className="max-w-md text-brand-100">
            Patients, appointments, consultations, laboratory, pharmacy and billing — connected in a
            single, secure, multi-tenant workflow.
          </p>
        </div>
        <p className="text-xs text-brand-200">© Rizomation AI</p>
      </div>

      <div className="flex items-center justify-center bg-slate-100 p-6">
        <div className="card w-full max-w-sm p-7">
          <h2 className="text-lg font-bold text-slate-800">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Access your hospital workspace.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
            )}
            <Button type="submit" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Prefilled with the seeded demo admin. No account?{' '}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              Register a hospital
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
