import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { fail, json, readJson } from '../_shared/http.ts';
import { adminClient, HttpError, requireRole } from '../_shared/supabase.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') return fail('Method not allowed.', 405);
    await requireRole(req, ['owner', 'admin']);
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();

    if (!email) return fail('email is required.', 400);
    if (password.length < 8) return fail('Password must be at least 8 characters.', 400);

    const service = adminClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    });
    if (createError || !created.user) throw createError || new Error('User creation failed.');

    const { error: profileError } = await service.from('profiles').insert({
      id: created.user.id,
      display_name: displayName || email,
      role: 'staff',
      active: true
    });

    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    return json({ success: true, userId: created.user.id });
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    return fail(error instanceof Error ? error.message : 'Create staff failed.', 500);
  }
});
