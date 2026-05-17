import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, SectionTitle } from '../components/Card';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/api';
import type { Coupon } from '../types';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function downloadCsv(filename: string, rows: Coupon[]) {
  const headers = ['short_code','reward','status','issued_reason','customer_label','expires_at','created_at','redeemed_at','redeemed_event','cancelled_at'];
  const lines = [headers.join(',')];
  for (const c of rows) {
    const values = [
      c.short_code,
      c.reward_types?.name || '',
      c.status,
      c.issued_reason || '',
      c.customer_label || '',
      c.expires_at,
      c.created_at,
      c.redeemed_at || '',
      c.redeemed_event || '',
      c.cancelled_at || ''
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(values.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function countBy(rows: Coupon[], getKey: (row: Coupon) => string) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row) || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function ReportsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('coupons')
        .select('*, reward_types(name)')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) setError(error.message);
      else setCoupons(data as Coupon[]);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const { start, end } = todayRange();
    const total = coupons.length;
    const redeemed = coupons.filter((c) => c.status === 'redeemed').length;
    const issued = coupons.filter((c) => c.status === 'issued').length;
    const cancelled = coupons.filter((c) => c.status === 'cancelled').length;
    const expiredUnused = coupons.filter((c) => c.status === 'issued' && new Date(c.expires_at) <= new Date()).length;
    const todayRedemptions = coupons.filter((c) => c.redeemed_at && new Date(c.redeemed_at) >= start && new Date(c.redeemed_at) < end);
    return {
      total,
      issued,
      redeemed,
      cancelled,
      expiredUnused,
      todayRedemptions,
      redemptionRate: total ? Math.round((redeemed / total) * 100) : 0,
      byReward: countBy(coupons, (c) => c.reward_types?.name || 'Unknown'),
      byReason: countBy(coupons, (c) => c.issued_reason || 'Unknown')
    };
  }, [coupons]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-navy md:text-4xl">Reports</h1>
          <p className="mt-1 text-navy/65">Coupon performance and redemptions.</p>
        </div>
        <button onClick={() => downloadCsv('voluvatt-coupons.csv', coupons)} className="focus-ring rounded-2xl bg-navy px-5 py-3 font-black text-white">
          <Download size={18} className="inline" /> Export CSV
        </button>
      </div>

      {loading && <p className="rounded-3xl bg-white p-4 shadow-soft">Loading reports…</p>}
      {error && <p className="rounded-3xl bg-red-50 p-4 font-semibold text-red-700 shadow-soft">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total issued" value={stats.total} />
        <Metric label="Active issued" value={stats.issued} />
        <Metric label="Redeemed" value={stats.redeemed} />
        <Metric label="Redemption rate" value={`${stats.redemptionRate}%`} />
        <Metric label="Today" value={stats.todayRedemptions.length} />
        <Metric label="Expired unused" value={stats.expiredUnused} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Coupons by reward type" />
          <BarList rows={stats.byReward} />
        </Card>
        <Card>
          <SectionTitle title="Coupons by source/reason" />
          <BarList rows={stats.byReason} />
        </Card>
      </div>

      <Card>
        <SectionTitle title="Today’s redemptions" subtitle="Based on this device’s local date." />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-navy/45">
              <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Reward</th><th className="px-3 py-2">Redeemed at</th><th className="px-3 py-2">Source</th></tr>
            </thead>
            <tbody>
              {stats.todayRedemptions.map((c) => (
                <tr key={c.id} className="border-t border-navy/5">
                  <td className="px-3 py-3 font-bold">{c.short_code}</td>
                  <td className="px-3 py-3">{c.reward_types?.name || 'Reward'}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(c.redeemed_at)}</td>
                  <td className="px-3 py-3">{c.issued_reason || '—'}</td>
                </tr>
              ))}
              {stats.todayRedemptions.length === 0 && <tr><td className="px-3 py-4 text-navy/55" colSpan={4}>No redemptions today yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-navy/45">{label}</p>
      <p className="mt-2 text-3xl font-black text-navy">{value}</p>
    </Card>
  );
}

function BarList({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-sm font-bold text-navy"><span>{label}</span><span>{value}</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-cloudCream">
            <div className="h-full rounded-full bg-navy" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-navy/55">No data yet.</p>}
    </div>
  );
}
