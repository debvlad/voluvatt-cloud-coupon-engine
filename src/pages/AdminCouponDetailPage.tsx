import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, Trash2 } from 'lucide-react';
import { Card, SectionTitle } from '../components/Card';
import { callFunction, displayCouponStatus, formatDateTime } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { downloadDataUrl, makeQrDataUrl } from '../lib/qr';
import { supabase } from '../lib/supabase';
import type { Coupon } from '../types';

function publicUrlForCoupon(coupon: Coupon) {
  if (!coupon.claim_path) return '';
  if (coupon.claim_path.startsWith('http://') || coupon.claim_path.startsWith('https://')) return coupon.claim_path;
  return `${window.location.origin}${coupon.claim_path.startsWith('/') ? '' : '/'}${coupon.claim_path}`;
}

function effectiveStatus(coupon: Coupon) {
  if (coupon.status === 'issued' && new Date(coupon.expires_at) <= new Date()) return 'expired';
  return coupon.status;
}

function isDisableable(coupon: Coupon) {
  return coupon.status === 'issued' && new Date(coupon.expires_at) > new Date();
}

export function AdminCouponDetailPage() {
  const { couponId = '' } = useParams();
  const { session } = useAuth();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCoupon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponId]);

  async function loadCoupon() {
    setLoading(true);
    setError('');
    setQr('');
    const { data, error } = await supabase
      .from('coupons')
      .select('*, reward_types(name)')
      .eq('id', couponId)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setCoupon(null);
      setLoading(false);
      return;
    }

    const loaded = data as Coupon | null;
    setCoupon(loaded);
    if (loaded) {
      const url = publicUrlForCoupon(loaded);
      if (url) setQr(await makeQrDataUrl(url, 620));
    }
    setLoading(false);
  }

  async function copy(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Copy failed. Select the text and copy manually.');
    }
  }

  async function disableCoupon() {
    if (!coupon) return;
    if (!window.confirm('Disable this unused coupon? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await callFunction('cancel-coupon', { couponId: coupon.id }, session);
      await loadCoupon();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/cancelled|cancel/gi, 'disabled') : 'Disable failed.');
    } finally {
      setBusy(false);
    }
  }

  const publicUrl = coupon ? publicUrlForCoupon(coupon) : '';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm font-bold text-navy/60 underline underline-offset-4"><ArrowLeft size={16} /> Back to admin</Link>
          <h1 className="mt-2 text-3xl font-black text-navy md:text-4xl">Coupon details</h1>
          <p className="mt-1 text-navy/65">QR code, public link, and backup code for one coupon.</p>
        </div>
        {coupon && isDisableable(coupon) && (
          <button disabled={busy} onClick={disableCoupon} className="focus-ring rounded-2xl bg-red-50 px-5 py-3 font-black text-red-700 disabled:opacity-60">
            <Trash2 size={18} className="inline" /> Disable
          </button>
        )}
      </div>

      {loading && <p className="rounded-3xl bg-white p-4 shadow-soft">Loading coupon…</p>}
      {error && <p className="rounded-3xl bg-red-50 p-4 font-semibold text-red-700 shadow-soft">{error}</p>}
      {!loading && !coupon && <p className="rounded-3xl bg-white p-4 text-navy/60 shadow-soft">Coupon not found.</p>}

      {coupon && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <SectionTitle title="QR code" subtitle="Show this to staff scanner, or use the backup code if the QR cannot be read." />
            {qr ? (
              <>
                <div className="rounded-3xl border border-navy/10 bg-white p-4">
                  <img src={qr} alt="Coupon QR code" className="mx-auto w-full max-w-sm" />
                </div>
                <button onClick={() => downloadDataUrl(qr, `${coupon.short_code}.png`)} className="focus-ring mt-4 w-full rounded-2xl bg-navy px-4 py-3 font-black text-white">
                  <Download size={17} className="inline" /> Download QR PNG
                </button>
              </>
            ) : (
              <div className="rounded-3xl bg-cloudCream p-5 text-navy/65">
                QR unavailable for this older coupon because its original claim link was not saved before this update.
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle title={coupon.short_code} subtitle={coupon.reward_types?.name || 'Cloud reward'} />
            <div className="space-y-4">
              <div className="rounded-3xl bg-cloudCream p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-navy/45">Status</p>
                <p className="mt-1 text-2xl font-black capitalize text-navy">{displayCouponStatus(effectiveStatus(coupon))}</p>
              </div>

              <div>
                <p className="text-sm font-black text-navy">Public link</p>
                {publicUrl ? (
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={publicUrl} className="min-w-0 flex-1 rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3 text-sm text-navy" />
                    <button onClick={() => copy(publicUrl)} className="focus-ring rounded-2xl bg-navy px-4 py-3 font-black text-white"><Copy size={17} /></button>
                  </div>
                ) : (
                  <p className="mt-1 rounded-2xl bg-cloudCream p-3 text-sm text-navy/60">Link unavailable for this older coupon.</p>
                )}
              </div>

              <div>
                <p className="text-sm font-black text-navy">Backup code</p>
                <div className="mt-1 flex gap-2">
                  <input readOnly value={coupon.short_code} className="min-w-0 flex-1 rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3 font-black tracking-[0.12em] text-navy" />
                  <button onClick={() => copy(coupon.short_code)} className="focus-ring rounded-2xl bg-cloudCream px-4 py-3 font-black text-navy"><Copy size={17} /></button>
                </div>
              </div>

              <dl className="grid gap-3 rounded-3xl border border-navy/10 p-4 text-sm sm:grid-cols-2">
                <div><dt className="font-black text-navy/45">Reason</dt><dd className="mt-1 text-navy">{coupon.issued_reason || '—'}</dd></div>
                <div><dt className="font-black text-navy/45">Expires</dt><dd className="mt-1 text-navy">{formatDateTime(coupon.expires_at)}</dd></div>
                <div><dt className="font-black text-navy/45">Created</dt><dd className="mt-1 text-navy">{formatDateTime(coupon.created_at)}</dd></div>
                <div><dt className="font-black text-navy/45">Redeemed</dt><dd className="mt-1 text-navy">{formatDateTime(coupon.redeemed_at)}</dd></div>
                <div><dt className="font-black text-navy/45">Disabled</dt><dd className="mt-1 text-navy">{formatDateTime(coupon.cancelled_at)}</dd></div>
                <div><dt className="font-black text-navy/45">Customer label</dt><dd className="mt-1 text-navy">{coupon.customer_label || '—'}</dd></div>
              </dl>

              {coupon.notes && (
                <div className="rounded-3xl bg-cloudYellow/45 p-4">
                  <p className="text-sm font-black text-navy/55">Private notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-navy">{coupon.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
