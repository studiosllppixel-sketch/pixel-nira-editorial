import { requireAdmin } from '../_auth.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const admin = await requireAdmin(req);
    if (!admin) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, admin: { username: admin.username, role: admin.role } });
  } catch (error) {
    console.error('Session check failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Session check failed.' });
  }
}
