import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { CheckCircle2, CircleStop, Keyboard, RotateCcw, ScanLine, XCircle } from 'lucide-react';
import { Card } from '../components/Card';
import { callFunction, extractTokenFromInput, formatDateTime } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { ValidatedCoupon } from '../types';

type ScanMode = 'camera' | 'manual';

type RedeemResult = ValidatedCoupon & {
  success: boolean;
};

function panel(status: ValidatedCoupon['status'] | 'empty' | 'success') {
  switch (status) {
    case 'success': return { label: 'REDEEMED SUCCESSFULLY', className: 'bg-green-600 text-white', icon: <CheckCircle2 size={56} /> };
    case 'valid': return { label: 'VALID', className: 'bg-green-600 text-white', icon: <CheckCircle2 size={56} /> };
    case 'redeemed': return { label: 'ALREADY REDEEMED', className: 'bg-red-600 text-white', icon: <XCircle size={56} /> };
    case 'expired': return { label: 'EXPIRED', className: 'bg-gray-600 text-white', icon: <CircleStop size={56} /> };
    case 'cancelled': return { label: 'CANCELLED', className: 'bg-red-950 text-white', icon: <XCircle size={56} /> };
    case 'invalid': return { label: 'INVALID', className: 'bg-red-950 text-white', icon: <XCircle size={56} /> };
    default: return { label: 'READY TO SCAN', className: 'bg-navy text-white', icon: <ScanLine size={56} /> };
  }
}

export function ScanPage() {
  const { session } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [mode, setMode] = useState<ScanMode>('camera');
  const [manual, setManual] = useState('');
  const [token, setToken] = useState('');
  const [coupon, setCoupon] = useState<ValidatedCoupon | null>(null);
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (mode !== 'camera') return;
    let stopped = false;
    async function startCamera() {
      setCameraError('');
      try {
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !busy) {
            const value = extractTokenFromInput(result.getText());
            if (value && value !== token) {
              controlsRef.current?.stop();
              setMode('manual');
              validate(value);
            }
          }
        });
      } catch (e) {
        if (!stopped) setCameraError(e instanceof Error ? e.message : 'Camera could not start. Use manual entry.');
      }
    }
    startCamera();
    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // validate is intentionally not included; camera should restart only when mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function validate(raw: string) {
    const parsed = extractTokenFromInput(raw);
    if (!parsed) return;
    setBusy(true);
    setError('');
    setCoupon(null);
    setRedeemResult(null);
    setToken(parsed);
    try {
      const result = await callFunction<ValidatedCoupon>('validate-coupon', {
        token: parsed,
        context: 'staff_scan',
        deviceInfo: navigator.userAgent
      }, session);
      setCoupon(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not validate coupon.');
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const result = await callFunction<RedeemResult>('redeem-coupon', {
        token,
        eventName: 'Võluvatt stand',
        deviceInfo: navigator.userAgent
      }, session);
      setRedeemResult(result);
      setCoupon(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Redeem failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setManual('');
    setToken('');
    setCoupon(null);
    setRedeemResult(null);
    setError('');
    setMode('camera');
  }

  const status = redeemResult?.success ? 'success' : (coupon?.status ?? 'empty');
  const p = panel(status);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card className="p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-navy">Staff Scanner</h1>
            <p className="text-sm text-navy/60">Fast one-handed QR redemption.</p>
          </div>
          <button onClick={reset} className="focus-ring rounded-2xl bg-cloudYellow/70 px-4 py-3 font-black text-navy">
            <RotateCcw size={18} className="inline" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cloudCream p-1">
          <button className={`rounded-xl px-4 py-3 font-black ${mode === 'camera' ? 'bg-navy text-white' : 'text-navy'}`} onClick={() => setMode('camera')}>Camera</button>
          <button className={`rounded-xl px-4 py-3 font-black ${mode === 'manual' ? 'bg-navy text-white' : 'text-navy'}`} onClick={() => setMode('manual')}><Keyboard className="inline" size={18}/> Manual</button>
        </div>

        {mode === 'camera' && (
          <div className="mt-4 overflow-hidden rounded-3xl bg-black">
            <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline />
          </div>
        )}
        {cameraError && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{cameraError}</p>}

        {mode === 'manual' && (
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); validate(manual); }}>
            <input className="focus-ring min-w-0 flex-1 rounded-2xl border border-navy/10 bg-cloudCream px-4 py-4" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste QR link or backup code" />
            <button disabled={busy} className="focus-ring rounded-2xl bg-navy px-5 py-4 font-black text-white disabled:opacity-60">Check</button>
          </form>
        )}
      </Card>

      <section className={`rounded-[2rem] p-6 text-center shadow-soft ${p.className}`}>
        <div className="mx-auto mb-3 grid place-items-center">{p.icon}</div>
        <p className="text-3xl font-black tracking-tight">{p.label}</p>
        {busy && <p className="mt-2 font-semibold opacity-90">Checking live database…</p>}
        {coupon && <p className="mt-2 text-lg font-bold opacity-95">{coupon.message}</p>}
      </section>

      {error && <p className="rounded-3xl bg-red-50 p-4 font-semibold text-red-700 shadow-soft">{error}</p>}

      {coupon && (
        <Card>
          <div className="space-y-3 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-navy/45">Reward</p>
            <h2 className="text-3xl font-black text-navy">{coupon.rewardName || 'Cloud Reward'}</h2>
            <p className="text-navy/65">Expires: <strong>{formatDateTime(coupon.expiresAt)}</strong></p>
            {coupon.redeemedAt && <p className="text-red-700">Redeemed: <strong>{formatDateTime(coupon.redeemedAt)}</strong></p>}
            {coupon.cancelledAt && <p className="text-red-950">Cancelled: <strong>{formatDateTime(coupon.cancelledAt)}</strong></p>}
            {coupon.customerLabel && <p className="text-sm text-navy/60">Label: {coupon.customerLabel}</p>}
            {coupon.shortCode && <p className="text-xs text-navy/45">Backup code: {coupon.shortCode}</p>}
          </div>

          {coupon.status === 'valid' && (
            <button disabled={busy} onClick={redeem} className="focus-ring mt-5 w-full rounded-[1.5rem] bg-green-600 px-6 py-5 text-2xl font-black text-white shadow-soft disabled:opacity-60">
              Redeem now
            </button>
          )}

          {redeemResult?.success && (
            <div className="mt-5 rounded-3xl bg-green-50 p-4 text-center font-black text-green-800">
              Success! This coupon is now permanently unusable.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
