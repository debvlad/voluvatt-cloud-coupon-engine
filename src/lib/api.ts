import type { Session } from '@supabase/supabase-js';
import { edgeBaseUrl } from './supabase';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function callFunction<T>(name: string, body: unknown, session?: Session | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  let response: Response;
  try {
    response = await fetch(`${edgeBaseUrl}/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {})
    });
  } catch (error) {
    throw new ApiError('Internet connection is required to validate one-time coupons.', 0, error);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed: ${response.status}`, response.status, payload);
  }

  return payload as T;
}

export function extractTokenFromInput(input: string): string {
  const value = input.trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const cIndex = parts.indexOf('c');
    if (cIndex >= 0 && parts[cIndex + 1]) return decodeURIComponent(parts[cIndex + 1]);
    const tokenParam = url.searchParams.get('token') || url.searchParams.get('code');
    if (tokenParam) return tokenParam;
  } catch {
    // Manual token/code entry, not a URL.
  }

  return value;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  }).format(new Date(value));
}

export function displayCouponStatus(status: string | null | undefined) {
  if (!status) return 'unknown';
  return status === 'cancelled' ? 'disabled' : status;
}
