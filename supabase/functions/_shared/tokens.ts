const TOKEN_BYTES = 20;
const SHORT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return `c_${base64Url(bytes)}`;
}

export function generateShortCode() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let code = 'VC-';
  for (const byte of bytes) code += SHORT_CHARS[byte % SHORT_CHARS.length];
  return code;
}

export async function hashToken(token: string) {
  const normalized = token.trim();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function looksLikeRawToken(value: string) {
  return value.trim().startsWith('c_');
}
