import { sql, safeEqual, hashToken, newSessionToken, sessionCookie } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host && new URL(origin).host !== host) return res.status(403).json({ error: 'Invalid request origin' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 120 || password.length > 1024) return res.status(400).json({ error: 'Enter your username and password.' });
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return res.status(503).json({ error: 'Admin login is not configured yet.' });
  if (!safeEqual(username, process.env.ADMIN_USERNAME) || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    await new Promise(r => setTimeout(r, 350));
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  try {
    const db = sql();
    let rows = await db`SELECT id, username, role FROM public.admin_users WHERE username=${process.env.ADMIN_USERNAME} LIMIT 1`;
    let admin = rows[0];
    if (!admin) {
      rows = await db`INSERT INTO public.admin_users (username, password_hash, role) VALUES (${process.env.ADMIN_USERNAME}, ${'managed-by-vercel-env'}, 'admin') RETURNING id, username, role`;
      admin = rows[0];
    }
    if (!admin) return res.status(500).json({ error: 'Could not initialize the admin account.' });
    const token = newSessionToken();
    const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db`INSERT INTO public.admin_sessions (admin_user_id, token_hash, expires_at) VALUES (${admin.id}, ${hashToken(token)}, ${expires.toISOString()})`;
    await db`UPDATE public.admin_users SET last_login_at=now(), updated_at=now() WHERE id=${admin.id}`;
    await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type) VALUES (${admin.id}, 'admin.login', 'session')`;
    res.setHeader('Set-Cookie', sessionCookie(token, 8 * 60 * 60));
    return res.status(200).json({ ok: true, admin: { username: admin.username, role: admin.role } });
  } catch (error) {
    console.error('Admin login failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Login service error. Please try again.' });
  }
}
