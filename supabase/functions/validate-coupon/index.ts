import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { fail, json, readJson } from '../_shared/http.ts';
import { adminClient, getUserAndProfile } from '../_shared/supabase.ts';
import { hashToken, looksLikeRawToken } from '../_shared/tokens.ts';
import { safeStatus, statusMessage, toSafeCoupon } from '../_shared/coupon.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') return fail('Method not allowed.', 405);
    const body = await readJson(req);
    const raw = String(body.token || body.code || '').trim();
    if (!raw) return fail('token or code is required.', 400);

    const service = adminClient();
    const auth = await getUserAndProfile(req);

    let coupon: any = null;
    let tokenHashForLog = await hashToken(raw);

    if (looksLikeRawToken(raw)) {
      const tokenHash = await hashToken(raw);
      tokenHashForLog = tokenHash;
      const { data, error } = await service
        .from('coupons')
        .select('id, status, expires_at, redeemed_at, cancelled_at, short_code, customer_label, issued_reason, reward_types(name)')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (error) throw error;
      coupon = data;
    } else {
      const { data, error } = await service
        .from('coupons')
        .select('id, token_hash, status, expires_at, redeemed_at, cancelled_at, short_code, customer_label, issued_reason, reward_types(name)')
        .eq('short_code', raw.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      coupon = data;
      if (coupon?.token_hash) tokenHashForLog = coupon.token_hash;
    }

    const status = safeStatus(coupon);

    if (body.context === 'staff_scan') {
      await service.from('coupon_scan_logs').insert({
        coupon_id: coupon?.id || null,
        token_hash: tokenHashForLog,
        scan_result: status,
        scanned_by: auth.user?.id || null,
        device_info: body.deviceInfo ? String(body.deviceInfo).slice(0, 500) : null,
        event_name: body.eventName ? String(body.eventName).slice(0, 120) : null
      });
    }

    if (!coupon) {
      return json({
        status: 'invalid',
        rewardName: null,
        expiresAt: null,
        redeemedAt: null,
        cancelledAt: null,
        shortCode: null,
        instructions: 'Show this QR code at the Võluvatt stand.',
        message: statusMessage('invalid')
      });
    }

    return json(toSafeCoupon(coupon));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Validation failed.', 500);
  }
});
