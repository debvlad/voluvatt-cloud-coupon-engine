import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { fail, json, readJson } from '../_shared/http.ts';
import { adminClient, HttpError, requireRole } from '../_shared/supabase.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') return fail('Method not allowed.', 405);
    const { user } = await requireRole(req, ['owner', 'admin']);
    const body = await readJson(req);
    const couponId = String(body.couponId || '').trim();
    if (!couponId) return fail('couponId is required.', 400);

    const service = adminClient();
    const { data, error } = await service
      .from('coupons')
      .update({ status: 'cancelled', cancelled_by: user.id, cancelled_at: new Date().toISOString() })
      .eq('id', couponId)
      .eq('status', 'issued')
      .select('id, status, cancelled_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const { data: existing } = await service.from('coupons').select('status').eq('id', couponId).maybeSingle();
      return fail(existing ? `Coupon cannot be disabled because it is ${existing.status}.` : 'Coupon not found.', 409);
    }

    return json({ success: true, coupon: data });
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    return fail(error instanceof Error ? error.message : 'Disable failed.', 500);
  }
});
