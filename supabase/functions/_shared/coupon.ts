import { adminClient } from './supabase.ts';
import { generateShortCode, generateToken, hashToken } from './tokens.ts';

export const publicInstructions = 'Show this QR code at the Võluvatt stand.';

export function safeStatus(row: any) {
  if (!row) return 'invalid';
  if (row.status === 'issued' && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  if (row.status === 'issued') return 'valid';
  if (row.status === 'redeemed') return 'redeemed';
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'expired') return 'expired';
  return 'invalid';
}

export function statusMessage(status: string) {
  switch (status) {
    case 'valid': return 'This cloud reward is valid.';
    case 'redeemed': return 'This cloud reward was already redeemed.';
    case 'expired': return 'This cloud reward has expired.';
    case 'cancelled': return 'This cloud reward was cancelled.';
    default: return 'This cloud reward is invalid.';
  }
}

export function toSafeCoupon(row: any) {
  const status = safeStatus(row);
  const rewardName = row?.reward_types?.name || row?.reward_name || null;
  return {
    status,
    rewardName,
    expiresAt: row?.expires_at || null,
    redeemedAt: row?.redeemed_at || null,
    cancelledAt: row?.cancelled_at || null,
    shortCode: row?.short_code || null,
    customerLabel: row?.customer_label || null,
    issuedReason: row?.issued_reason || null,
    instructions: publicInstructions,
    message: statusMessage(status)
  };
}

export function getPublicAppUrl(req: Request) {
  return (Deno.env.get('PUBLIC_APP_URL') || req.headers.get('Origin') || '').replace(/\/$/, '');
}

export async function createCouponRecord(params: {
  req: Request;
  rewardTypeId: string;
  expiresAt?: string | null;
  issuedReason?: string | null;
  customerLabel?: string | null;
  customerContact?: string | null;
  notes?: string | null;
  createdBy: string;
}) {
  const service = adminClient();

  const { data: reward, error: rewardError } = await service
    .from('reward_types')
    .select('*')
    .eq('id', params.rewardTypeId)
    .eq('active', true)
    .maybeSingle();

  if (rewardError) throw new Error(rewardError.message);
  if (!reward) throw new Error('Reward type not found or inactive.');

  let expiresAt = params.expiresAt;
  if (!expiresAt) {
    const d = new Date();
    d.setDate(d.getDate() + Number(reward.default_expiry_days || 30));
    expiresAt = d.toISOString();
  }

  const publicAppUrl = getPublicAppUrl(params.req);
  if (!publicAppUrl) throw new Error('PUBLIC_APP_URL is not configured and request Origin is missing.');

  for (let attempt = 0; attempt < 8; attempt++) {
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const shortCode = generateShortCode();

    const { data, error } = await service
      .from('coupons')
      .insert({
        token_hash: tokenHash,
        short_code: shortCode,
        reward_type_id: params.rewardTypeId,
        issued_reason: params.issuedReason || null,
        customer_label: params.customerLabel || null,
        customer_contact: params.customerContact || null,
        notes: params.notes || null,
        expires_at: expiresAt,
        created_by: params.createdBy
      })
      .select('id, short_code, expires_at')
      .single();

    if (!error && data) {
      const publicUrl = `${publicAppUrl}/c/${encodeURIComponent(token)}`;
      return {
        token,
        publicUrl,
        qrData: publicUrl,
        shortCode: data.short_code,
        rewardName: reward.name,
        expiresAt: data.expires_at
      };
    }

    if (!String(error?.message || '').includes('duplicate')) throw new Error(error?.message || 'Coupon creation failed.');
  }

  throw new Error('Could not generate a unique coupon token. Try again.');
}
