import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { TextField } from '../components/ui/Field';
import { Button } from '../components/ui/primitives';
import { ApiError } from '../lib/apiError';
import { useToast } from '../components/ui/Toast';

export function RegisterPage() {
  const { register, login, status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    hospitalName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await register({ ...form, email: form.email.trim() });
      await login(form.email.trim(), form.password);
      toast.success('Hospital created — welcome aboard.');
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldMap);
        if (err.fieldErrors.length === 0) toast.error(err.message);
      } else {
        toast.error('Registration failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-slate-100 p-6">
      <div className="card w-full max-w-md p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-white">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Register a hospital</h2>
            <p className="text-xs text-slate-500">Creates the tenant and its first admin account.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <TextField label="Hospital name" required value={form.hospitalName} onChange={set('hospitalName')} error={errors.hospitalName} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First name" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
            <TextField label="Last name" required value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
          </div>
          <TextField label="Email" type="email" required value={form.email} onChange={set('email')} error={errors.email} />
          <TextField
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            hint="Minimum 8 characters."
          />
          <Button type="submit" loading={busy} className="w-full">
            Create hospital & sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
