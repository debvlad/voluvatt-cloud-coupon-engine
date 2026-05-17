import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function anonClientWithAuth(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } }
  });
}

export async function getUserAndProfile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { user: null, profile: null };

  const authClient = anonClientWithAuth(req);
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return { user: null, profile: null };

  const service = adminClient();
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, display_name, role, active, created_at')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile) return { user: userData.user, profile: null };
  return { user: userData.user, profile };
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function requireRole(req: Request, allowedRoles: string[]) {
  const { user, profile } = await getUserAndProfile(req);
  if (!user) throw new HttpError('Authentication required.', 401);
  if (!profile?.active || !allowedRoles.includes(profile.role)) {
    throw new HttpError('Not authorized.', 403);
  }
  return { user, profile };
}
