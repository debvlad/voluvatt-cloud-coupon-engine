import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Gift, Wand2 } from 'lucide-react';
import { callFunction, formatDate } from '../lib/api';
import { makeQrDataUrl } from '../lib/qr';
import type { ValidatedCoupon } from '../types';

function statusClass(status: string) {
  if (status === 'valid') return 'bg-green-50 text-green-800 border-green-200';
  if (status === 'redeemed') return 'bg-red-50 text-red-800 border-red-200';
  if (status === 'expired') return 'bg-gray-100 text-gray-700 border-gray-200';
  return 'bg-red-950 text-white border-red-950';
}

export function CustomerCouponPage() {
  const { token = '' } = useParams();
  const [coupon, setCoupon] = useState<ValidatedCoupon | null>(null);
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const result = await callFunction<ValidatedCoupon>('validate-coupon', { token, context: 'customer' });
        if (!mounted) return;
        setCoupon(result);
        const publicUrl = `${window.location.origin}/c/${encodeURIComponent(token)}`;
        setQr(await makeQrDataUrl(publicUrl, 560));
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Could not validate coupon.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [token]);

  return (
    <div className="min-h-screen cloud-bg px-4 py-8">
      <main className="mx-auto max-w-lg rounded-[2rem] bg-white p-5 text-center shadow-soft md:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.5rem] bg-navy text-white">
          <Wand2 size={32} />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-navy/50">Võluvatt Cloud Reward</p>
        <h1 className="mt-2 text-3xl font-black text-navy">You unlocked a Võluvatt Cloud Reward!</h1>

        {loading && <p className="mt-8 text-navy/70">Checking your cloud…</p>}
        {error && <p className="mt-8 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}

        {coupon && (
          <div className="mt-6 space-y-5">
            <div className={`rounded-3xl border p-4 ${statusClass(coupon.status)}`}>
              <p className="text-sm font-black uppercase tracking-[0.18em]">{coupon.status}</p>
              <p className="mt-1 text-lg font-bold">{coupon.message}</p>
            </div>

            <div className="rounded-3xl bg-cloudCream p-4">
              <Gift className="mx-auto text-navy" />
              <p className="mt-2 text-sm font-bold text-navy/55">Reward</p>
              <p className="text-2xl font-black text-navy">{coupon.rewardName || 'Cloud Reward'}</p>
              <p className="mt-2 text-sm text-navy/65">Expires: <strong>{formatDate(coupon.expiresAt)}</strong></p>
              {coupon.shortCode && <p className="mt-1 text-xs text-navy/50">Backup code: {coupon.shortCode}</p>}
            </div>

            {qr && coupon.status === 'valid' && (
              <div className="rounded-3xl border border-navy/10 bg-white p-3">
                <img className="mx-auto w-full max-w-xs" src={qr} alt="Võluvatt coupon QR code" />
              </div>
            )}

            <div className="rounded-3xl bg-cloudYellow/45 p-4 text-left text-navy">
              <p className="font-black">Show this QR code at the Võluvatt stand.</p>
              <p className="mt-2">Bring this cloud back before it melts into the sky.</p>
              <p className="mt-2 text-sm text-navy/65">Internet is required at redemption so every coupon can only be used once.</p>
            </div>
          </div>
        )}

        <Link to="/login" className="mt-6 inline-block text-sm font-bold text-navy/55 underline">Staff login</Link>
      </main>
    </div>
  );
}
