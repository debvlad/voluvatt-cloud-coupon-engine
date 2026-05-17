import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Copy, Download, Plus, Trash2, UserPlus } from 'lucide-react';
import { Card, SectionTitle } from '../components/Card';
import { callFunction, formatDateTime } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { downloadDataUrl, makeQrDataUrl } from '../lib/qr';
import type { Coupon, CreatedCoupon, Profile, RewardType } from '../types';

const reasons = [
  'Cloud Quest completed',
  'Birthday reward',
  'Instagram tag',
  'Referral reward',
  'Secret Flavor',
  'Manual'
];

type CreatedWithQr = CreatedCoupon & { qrImage: string };

function defaultExpiry(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString().slice(0, 16);
}

function toIsoFromInput(value: string) {
  return new Date(value).toISOString();
}

export function AdminPage() {
  const { session, profile } = useAuth();
  const [rewardTypes, setRewardTypes] = useState<RewardType[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [rewardTypeId, setRewardTypeId] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [issuedReason, setIssuedReason] = useState(reasons[0]);
  const [customerLabel, setCustomerLabel] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [notes, setNotes] = useState('');
  const [batchQuantity, setBatchQuantity] = useState(5);
  const [created, setCreated] = useState<CreatedWithQr[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffName, setStaffName] = useState('');

  const selectedReward = useMemo(() => rewardTypes.find((r) => r.id === rewardTypeId), [rewardTypes, rewardTypeId]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedReward) setExpiresAt(defaultExpiry(selectedReward.default_expiry_days));
  }, [selectedReward?.id]);

  async function loadAll() {
    setError('');
    const [rewardsResult, couponsResult, staffResult] = await Promise.all([
      supabase.from('reward_types').select('*').eq('active', true).order('name'),
      supabase.from('coupons').select('*, reward_types(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, display_name, role, active, created_at').order('created_at', { ascending: false })
    ]);

    if (rewardsResult.error) setError(rewardsResult.error.message);
    else {
      const rewards = rewardsResult.data as RewardType[];
      setRewardTypes(rewards);
      if (!rewardTypeId && rewards[0]) setRewardTypeId(rewards[0].id);
    }

    if (couponsResult.error) setError(couponsResult.error.message);
    else setCoupons(couponsResult.data as Coupon[]);

    if (staffResult.error) setError(staffResult.error.message);
    else setStaff(staffResult.data as Profile[]);
  }

  async function decorateCreated(items: CreatedCoupon[]) {
    const withQr: CreatedWithQr[] = [];
    for (const item of items) {
      withQr.push({ ...item, qrImage: await makeQrDataUrl(item.publicUrl, 460) });
    }
    setCreated(withQr);
  }

  async function createOne(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await callFunction<CreatedCoupon>('create-coupon', {
        rewardTypeId,
        expiresAt: toIsoFromInput(expiresAt),
        issuedReason,
        customerLabel: customerLabel || null,
        customerContact: customerContact || null,
        notes: notes || null
      }, session);
      await decorateCreated([result]);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create coupon failed.');
    } finally {
      setBusy(false);
    }
  }

  async function createBatch() {
    setBusy(true);
    setError('');
    try {
      const result = await callFunction<{ coupons: CreatedCoupon[] }>('create-batch-coupons', {
        quantity: batchQuantity,
        rewardTypeId,
        expiresAt: toIsoFromInput(expiresAt),
        issuedReason,
        customerLabel: customerLabel || null,
        customerContact: customerContact || null,
        notes: notes || null
      }, session);
      await decorateCreated(result.coupons);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch create failed.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelCoupon(couponId: string) {
    if (!window.confirm('Cancel this unused coupon?')) return;
    setBusy(true);
    setError('');
    try {
      await callFunction('cancel-coupon', { couponId }, session);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed.');
    } finally {
      setBusy(false);
    }
  }

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await callFunction('create-staff-user', {
        email: staffEmail,
        password: staffPassword,
        displayName: staffName
      }, session);
      setStaffEmail('');
      setStaffPassword('');
      setStaffName('');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create staff failed.');
    } finally {
      setBusy(false);
    }
  }

  async function deactivateStaff(staffUserId: string) {
    if (!window.confirm('Deactivate this staff login?')) return;
    setBusy(true);
    setError('');
    try {
      await callFunction('deactivate-staff-user', { staffUserId }, session);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deactivate failed.');
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-navy md:text-4xl">Admin Dashboard</h1>
        <p className="mt-1 text-navy/65">Create one-time cloud rewards, staff logins, and coupon links.</p>
      </div>

      {error && <p className="rounded-3xl bg-red-50 p-4 font-semibold text-red-700 shadow-soft">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card>
          <SectionTitle title="Create coupons" subtitle="Only owner/admin accounts can generate coupons. Tokens are random and hashed in the database." />
          <form className="grid gap-4" onSubmit={createOne}>
            <label>
              <span className="text-sm font-bold text-navy">Reward type</span>
              <select className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" value={rewardTypeId} onChange={(e) => setRewardTypeId(e.target.value)} required>
                {rewardTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-bold text-navy">Expiration date</span>
                <input className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
              </label>
              <label>
                <span className="text-sm font-bold text-navy">Reason/source</span>
                <select className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" value={issuedReason} onChange={(e) => setIssuedReason(e.target.value)}>
                  {reasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-bold text-navy">Optional customer label</span>
                <input className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" value={customerLabel} onChange={(e) => setCustomerLabel(e.target.value)} placeholder="Example: Oliver / Bingo row" />
              </label>
              <label>
                <span className="text-sm font-bold text-navy">Optional contact</span>
                <input className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} placeholder="Parent email or phone, optional" />
              </label>
            </div>

            <label>
              <span className="text-sm font-bold text-navy">Private notes</span>
              <textarea className="focus-ring mt-1 w-full rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <button disabled={busy} className="focus-ring rounded-2xl bg-navy px-5 py-4 font-black text-white disabled:opacity-60"><Plus size={18} className="inline" /> Generate one coupon</button>
              <div className="flex gap-2">
                <input className="focus-ring w-24 rounded-2xl border border-navy/10 bg-cloudCream px-3 py-3" type="number" min={1} max={100} value={batchQuantity} onChange={(e) => setBatchQuantity(Number(e.target.value))} />
                <button type="button" disabled={busy} onClick={createBatch} className="focus-ring rounded-2xl bg-cloudPink px-5 py-4 font-black text-navy disabled:opacity-60">Batch</button>
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle title="Generated links" subtitle="Copy links or download QR PNGs immediately after generation." />
          {created.length === 0 && <p className="rounded-3xl bg-cloudCream p-4 text-navy/65">No newly generated coupons yet.</p>}
          <div className="space-y-4">
            {created.map((item) => (
              <div key={item.shortCode} className="rounded-3xl border border-navy/10 p-4">
                <img src={item.qrImage} alt="Coupon QR" className="mx-auto w-48" />
                <p className="mt-2 text-center text-lg font-black text-navy">{item.rewardName}</p>
                <p className="text-center text-xs text-navy/55">{item.shortCode} · expires {formatDateTime(item.expiresAt)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => copy(item.publicUrl)} className="focus-ring rounded-2xl bg-cloudCream px-3 py-3 font-bold text-navy"><Copy size={16} className="inline" /> Copy</button>
                  <button onClick={() => downloadDataUrl(item.qrImage, `${item.shortCode}.png`)} className="focus-ring rounded-2xl bg-navy px-3 py-3 font-bold text-white"><Download size={16} className="inline" /> PNG</button>
                </div>
                <p className="mt-2 break-all rounded-2xl bg-cloudCream p-2 text-xs text-navy/60">{item.publicUrl}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Coupon list" subtitle="Newest 200 coupons. Cancel only works for unused issued coupons." />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-navy/45">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Reward</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Redeemed</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const effectiveStatus = c.status === 'issued' && new Date(c.expires_at) <= new Date() ? 'expired' : c.status;
                return (
                  <tr key={c.id} className="border-t border-navy/5">
                    <td className="px-3 py-3 font-bold text-navy">{c.short_code}</td>
                    <td className="px-3 py-3">{c.reward_types?.name || c.reward_type_id}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-cloudCream px-3 py-1 font-bold">{effectiveStatus}</span></td>
                    <td className="px-3 py-3">{c.issued_reason || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(c.expires_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(c.redeemed_at)}</td>
                    <td className="px-3 py-3">
                      {c.status === 'issued' && new Date(c.expires_at) > new Date() && (
                        <button disabled={busy} onClick={() => cancelCoupon(c.id)} className="rounded-xl bg-red-50 px-3 py-2 font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} className="inline" /> Cancel</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Staff users" subtitle="Create staff accounts for scanning only. Deactivated staff cannot pass role checks." />
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={createStaff}>
          <input className="focus-ring rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="staff@email.com" required />
          <input className="focus-ring rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Display name" />
          <input className="focus-ring rounded-2xl border border-navy/10 bg-cloudCream px-4 py-3" type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="Temporary password" required minLength={8} />
          <button disabled={busy} className="focus-ring rounded-2xl bg-navy px-5 py-3 font-black text-white disabled:opacity-60"><UserPlus size={17} className="inline" /> Create</button>
        </form>

        <div className="grid gap-2">
          {staff.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cloudCream px-4 py-3">
              <div>
                <p className="font-black text-navy">{s.display_name || 'Unnamed user'} {s.id === profile?.id && <span className="text-xs text-navy/40">(you)</span>}</p>
                <p className="text-sm text-navy/55">{s.role} · {s.active ? 'active' : 'inactive'}</p>
              </div>
              {s.role === 'staff' && s.active && (
                <button disabled={busy} onClick={() => deactivateStaff(s.id)} className="rounded-xl bg-red-50 px-3 py-2 font-bold text-red-700 disabled:opacity-60">Deactivate</button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
