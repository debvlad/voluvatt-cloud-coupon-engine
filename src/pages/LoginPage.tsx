import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  useEffect(() => {
    if (!loading && user && profile?.active) {
      navigate(from || (profile.role === 'staff' ? '/scan' : '/admin'), { replace: true });
    }
  }, [loading, user, profile, from, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
  }

  if (!loading && user && profile?.active) {
    return <Navigate to={from || (profile.role === 'staff' ? '/scan' : '/admin')} replace />;
  }

  return (
    <div className="grid min-h-screen place-items-center cloud-bg px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-soft">
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.5rem] bg-navy text-white shadow-soft">
            <Wand2 size={32} />
          </div>
          <h1 className="mt-4 text-3xl font-black text-navy">Võluvatt Coupons</h1>
          <p className="mt-2 text-navy/65">Login for staff scanning and admin coupon creation.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-navy">Email</span>
            <input className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-navy">Password</span>
            <input className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <button disabled={busy} className="focus-ring w-full rounded-2xl bg-navy px-5 py-4 text-lg font-black text-white disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
