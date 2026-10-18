import { sql, cookieValue, hashToken, sessionCookie } from '../_auth.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const token = cookieValue(req, 'pixel_admin_session');
  try {
    if (token && process.env.DATABASE_URL) await sql()`DELETE FROM public.admin_sessions WHERE token_hash=${hashToken(token)}`;
  } catch (error) { console.error('Logout cleanup failed:', error?.message || 'unknown error'); }
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return res.status(200).json({ ok: true });
}
