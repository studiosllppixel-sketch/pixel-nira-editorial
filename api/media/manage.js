import { deleteR2Object } from './r2.js';
import { requireAdmin, sql } from '../_auth.js';

const allowedBrands = new Set(['pixel-studios', 'nira-editorial', 'shared']);
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return res.status(401).json({ error: 'Sign in required.' });
  const body = req.body || {};
  const pathname = String(body.pathname || '');
  const action = String(body.action || '');
  if (!pathname.startsWith('media/') || pathname.length > 500 || pathname.includes('..') || pathname.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid media path.' });
  }
  try {
    const db = sql();
    const assets = await db`SELECT id, brand, object_key, original_filename FROM public.media_assets WHERE object_key=${pathname} LIMIT 1`;
    if (!assets.length) return res.status(404).json({ error: 'Image not found in the media library.' });
    if (action === 'move') {
      const brand = String(body.brand || '');
      if (!allowedBrands.has(brand)) return res.status(400).json({ error: 'Choose a valid destination brand.' });
      await db`UPDATE public.media_assets SET brand=${brand} WHERE object_key=${pathname}`;
      await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id) VALUES (${admin.id}, 'media.move', 'media', ${pathname})`;
      return res.status(200).json({ ok: true, brand });
    }
    if (action === 'delete') {
      const encoded = pathname.replace(/\\//g, '%2F');
      const refs = await db`SELECT page_key, status FROM public.site_pages WHERE COALESCE(draft_content::text,'') LIKE '%' || ${pathname} || '%' OR COALESCE(published_content::text,'') LIKE '%' || ${pathname} || '%' OR COALESCE(draft_content::text,'') LIKE '%' || ${encoded} || '%' OR COALESCE(published_content::text,'') LIKE '%' || ${encoded} || '%' LIMIT 1`;
      if (refs.length) return res.status(409).json({ error: 'This image is used on a saved or published page (' + refs[0].page_key + '). Remove it from that page first; the file was not deleted.' });
      await deleteR2Object(pathname);
      await db`DELETE FROM public.media_assets WHERE object_key=${pathname}`;
      await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id) VALUES (${admin.id}, 'media.delete', 'media', ${pathname})`;
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid media action.' });
  } catch (error) {
    console.error('Media management failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not update this image. No other images were changed.' });
  }
}
