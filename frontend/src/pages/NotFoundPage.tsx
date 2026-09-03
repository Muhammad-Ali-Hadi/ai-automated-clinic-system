import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div>
        <p className="text-5xl font-bold text-brand-700">404</p>
        <p className="mt-2 text-sm text-slate-500">This screen doesn’t exist.</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
