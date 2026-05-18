import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { fail, json, readJson } from '../_shared/http.ts';
import { adminClient, HttpError, requireRole } from '../_shared/supabase.ts';
import { hashToken, looksLikeRawToken } from '../_shared/tokens.ts';
import { statusMessage } from '../_shared/coupon.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') return fail('Method not allowed.', 405);
    const { user } = await requireRole(req, ['owner', 'admin', 'staff']);
    const body = await readJson(req);
    const raw = String(body.token || body.code || '').trim();
    if (!raw) return fail('token or code is required.', 400);

    const service = adminClient();
    let tokenHash = await hashToken(raw);

    if (!looksLikeRawToken(raw)) {
      const { data, error } = await service.from('coupons').select('token_hash').eq('short_code', raw.toUpperCase()).maybeSingle();
      if (error) throw error;
      if (!data) {
        await service.from('coupon_scan_logs').insert({
          coupon_id: null,
          token_hash: tokenHash,
          scan_result: 'redeem_invalid',
          scanned_by: user.id,
          device_info: body.deviceInfo ? String(body.deviceInfo).slice(0, 500) : null,
          event_name: body.eventName ? String(body.eventName).slice(0, 120) : null
        });
        return json({
          success: false,
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
      tokenHash = data.token_hash;
    }

    const { data, error } = await service.rpc('redeem_coupon_atomic', {
      p_token_hash: tokenHash,
      p_redeemed_by: user.id,
      p_event_name: body.eventName ? String(body.eventName).slice(0, 120) : null
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const safeStatus = row?.safe_status || 'invalid';

    await service.from('coupon_scan_logs').insert({
      coupon_id: row?.coupon_id || null,
      token_hash: tokenHash,
      scan_result: `redeem_${row?.result || safeStatus}`,
      scanned_by: user.id,
      device_info: body.deviceInfo ? String(body.deviceInfo).slice(0, 500) : null,
      event_name: body.eventName ? String(body.eventName).slice(0, 120) : null
    });

    return json({
      success: row?.result === 'success',
      status: safeStatus,
      rewardName: row?.reward_name || null,
      expiresAt: row?.expires_at || null,
      redeemedAt: row?.redeemed_at || null,
      cancelledAt: row?.cancelled_at || null,
      shortCode: row?.short_code || null,
      customerLabel: row?.customer_label || null,
      issuedReason: row?.issued_reason || null,
      instructions: 'Show this QR code at the Võluvatt stand.',
      message: row?.result === 'cancelled' ? 'Coupon was disabled.' : (row?.message || statusMessage(safeStatus))
    });
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    return fail(error instanceof Error ? error.message : 'Redeem failed.', 500);
  }
});
