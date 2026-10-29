import { readR2Object } from './r2.js';
import { requireAdmin, sql } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const pathname = typeof req.query?.pathname === 'string' ? req.query.pathname : '';
  if (!pathname || pathname.length > 500 || pathname.includes('..') || pathname.startsWith('/')) return res.status(400).json({ error: 'Invalid media path.' });
  try {
    const db = sql();
    const rows = await db`SELECT m.id,
      EXISTS (
        SELECT 1 FROM public.site_pages p
        WHERE p.status = 'published'
          AND p.published_content::text LIKE '%' || replace(${pathname}, '/', '%2F') || '%'
      ) AS is_published
      FROM public.media_assets m WHERE m.object_key = ${pathname} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ error: 'Media not found.' });
    const admin = await requireAdmin(req).catch(() => null);
    if (!admin && !rows[0].is_published) return res.status(401).json({ error: 'Sign in required.' });
    res.setHeader('Cache-Control', rows[0].is_published ? 'public, max-age=300' : 'private, no-store');
    const result = await readR2Object(pathname);
    if (!result?.Body) return res.status(404).json({ error: 'Media not found.' });
    res.setHeader('Content-Type', result.ContentType || rows[0].content_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    if (Number.isFinite(result.ContentLength)) res.setHeader('Content-Length', String(result.ContentLength));
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    return res.status(200).send(bytes);
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return res.status(404).json({ error: 'Media not found.' });
    console.error('Media read failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not load media.' });
  }
}
