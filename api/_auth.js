import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const sql = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
};
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function cookieValue(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
export function sessionCookie(token, maxAge) {
  return 'pixel_admin_session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}
export async function requireAdmin(req) {
  const token = cookieValue(req, 'pixel_admin_session');
  if (!token) return null;
  const db = sql();
  const rows = await db`SELECT u.id, u.username, u.role FROM public.admin_sessions s JOIN public.admin_users u ON u.id=s.admin_user_id WHERE s.token_hash=${hashToken(token)} AND s.expires_at > now() AND u.is_active=true LIMIT 1`;
  return rows[0] || null;
}
export function newSessionToken() { return randomBytes(32).toString('base64url'); }
