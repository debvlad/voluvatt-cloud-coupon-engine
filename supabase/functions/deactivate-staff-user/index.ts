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
    const staffUserId = String(body.staffUserId || '').trim();
    if (!staffUserId) return fail('staffUserId is required.', 400);
    if (staffUserId === user.id) return fail('You cannot deactivate your own account.', 400);

    const service = adminClient();
    const { data, error } = await service
      .from('profiles')
      .update({ active: false })
      .eq('id', staffUserId)
      .eq('role', 'staff')
      .select('id, display_name, role, active')
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail('Active staff user not found.', 404);

    return json({ success: true, profile: data });
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    return fail(error instanceof Error ? error.message : 'Deactivate staff failed.', 500);
  }
});
