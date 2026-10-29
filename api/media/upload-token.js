import { presignR2Upload } from './r2.js';
import { requireAdmin, sql } from '../_auth.js';

const allowedBrands = new Set(['pixel-studios', 'nira-editorial', 'shared']);
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const maxSize = 30 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const body = req.body || {};
    const action = body.action;
    const brand = body.brand;
    const contentType = body.contentType;
    const size = Number(body.size);
    const filename = String(body.filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);

    if (!allowedBrands.has(brand) || !allowedTypes.has(contentType) || !Number.isFinite(size) || size < 1 || size > maxSize) {
      return res.status(400).json({ error: 'Choose a supported image under 30 MB.' });
    }

    if (action === 'sign') {
      const pathname = `media/${Date.now()}-${filename}`;
      const presignedUrl = await presignR2Upload({ pathname, contentType, size });
      return res.status(200).json({ pathname, presignedUrl });
    }

    if (action === 'register') {
      const pathname = String(body.pathname || '');
      if (!pathname.startsWith('media/') || pathname.length > 500 || pathname.includes('..')) {
        return res.status(400).json({ error: 'Invalid media path.' });
      }
      const db = sql();
      await db`INSERT INTO public.media_assets (brand, object_key, original_filename, content_type, size_bytes, created_by)
        VALUES (${brand}, ${pathname}, ${String(body.originalFilename || filename).slice(0, 200)}, ${contentType}, ${size}, ${admin.id})
        ON CONFLICT (object_key) DO NOTHING`;
      await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id)
        VALUES (${admin.id}, 'media.upload', 'media', ${pathname})`;
      return res.status(200).json({ ok: true, pathname });
    }

    return res.status(400).json({ error: 'Invalid upload action.' });
  } catch (error) {
    console.error('Media upload failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not authorize this upload. Check the R2 configuration.' });
  }
}
