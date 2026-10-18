import { sql, requireAdmin } from '../_auth.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const brand = typeof req.query?.brand === 'string' ? req.query.brand : '';
    const rows = brand && ['pixel-studios','nira-editorial','shared'].includes(brand)
      ? await sql()`SELECT id, brand, object_key, original_filename, content_type, size_bytes, width, height, alt_text, created_at FROM public.media_assets WHERE brand=${brand} ORDER BY created_at DESC LIMIT 300`
      : await sql()`SELECT id, brand, object_key, original_filename, content_type, size_bytes, width, height, alt_text, created_at FROM public.media_assets ORDER BY created_at DESC LIMIT 300`;
    return res.status(200).json({ assets: rows });
  } catch (error) {
    console.error('Media library query failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not load media library.' });
  }
}
