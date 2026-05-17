import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { fail, json, readJson } from '../_shared/http.ts';
import { HttpError, requireRole } from '../_shared/supabase.ts';
import { createCouponRecord } from '../_shared/coupon.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') return fail('Method not allowed.', 405);
    const { user } = await requireRole(req, ['owner', 'admin']);
    const body = await readJson(req);

    const quantity = Math.max(1, Math.min(100, Number(body.quantity || 1)));
    if (!body.rewardTypeId) return fail('rewardTypeId is required.', 400);

    const coupons = [];
    for (let i = 0; i < quantity; i++) {
      coupons.push(await createCouponRecord({
        req,
        rewardTypeId: String(body.rewardTypeId),
        expiresAt: body.expiresAt ? String(body.expiresAt) : null,
        issuedReason: body.issuedReason ? String(body.issuedReason) : null,
        customerLabel: body.customerLabel ? String(body.customerLabel) : null,
        customerContact: body.customerContact ? String(body.customerContact) : null,
        notes: body.notes ? String(body.notes) : null,
        createdBy: user.id
      }));
    }

    return json({ coupons });
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    return fail(error instanceof Error ? error.message : 'Batch creation failed.', 500);
  }
});
