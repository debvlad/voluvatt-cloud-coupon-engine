import { corsHeaders } from './cors.ts';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...(extra || {}) }, status);
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
