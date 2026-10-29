import { get } from '@vercel/blob';
import { readR2Object } from './r2.js';
import { requireAdmin, sql } from '../_auth.js';

function isMissingObject(error) {
  return error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const pathname = typeof req.query?.pathname === 'string' ? req.query.pathname : '';
  if (!pathname || pathname.length > 500 || pathname.includes('..') || pathname.startsWith('/')) return res.status(400).json({ error: 'Invalid media path.' });
  try {
    const db = sql();
    const rows = await db`SELECT m.id, m.content_type,
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

    let contentType = rows[0].content_type || 'application/octet-stream';
    let bytes;
    try {
      const result = await readR2Object(pathname);
      if (!result?.Body) return res.status(404).json({ error: 'Media not found.' });
      contentType = result.ContentType || contentType;
      bytes = Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (!isMissingObject(error)) throw error;
      // Transitional fallback keeps existing Vercel Blob media visible until it is copied to R2.
      const legacy = await get(pathname, { access: 'private' });
      if (!legacy || legacy.statusCode !== 200) return res.status(404).json({ error: 'Media not found.' });
      contentType = legacy.blob?.contentType || contentType;
      bytes = Buffer.from(await new Response(legacy.stream).arrayBuffer());
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', String(bytes.length));
    return res.status(200).send(bytes);
  } catch (error) {
    if (isMissingObject(error)) return res.status(404).json({ error: 'Media not found.' });
    console.error('Media read failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not load media.' });
  }
}
