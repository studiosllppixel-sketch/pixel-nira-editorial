import { get } from '@vercel/blob';
import { requireAdmin, sql } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return res.status(401).json({ error: 'Sign in required.' });
  const pathname = typeof req.query?.pathname === 'string' ? req.query.pathname : '';
  if (!pathname || pathname.length > 500 || pathname.includes('..') || pathname.startsWith('/')) return res.status(400).json({ error: 'Invalid media path.' });
  try {
    const rows = await sql()`SELECT id FROM public.media_assets WHERE object_key=${pathname} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ error: 'Media not found.' });
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return res.status(404).json({ error: 'Media not found.' });
    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    return result.stream.pipe(res);
  } catch (error) {
    console.error('Media read failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not load media.' });
  }
}
