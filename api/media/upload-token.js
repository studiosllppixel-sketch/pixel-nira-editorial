import { handleUpload } from '@vercel/blob/client';
import { requireAdmin, sql } from '../_auth.js';
const allowedBrands = new Set(['pixel-studios', 'nira-editorial', 'shared']);
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = JSON.parse(clientPayload || '{}'); } catch {}
        const brand = payload.brand;
        const contentType = payload.contentType;
        const size = Number(payload.size);
        if (!allowedBrands.has(brand) || !allowedTypes.has(contentType) || !Number.isFinite(size) || size < 1 || size > 30 * 1024 * 1024) throw new Error('Invalid media type, brand, or file size.');
        const safeName = String(payload.filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
        return { allowedContentTypes: [...allowedTypes], maximumSizeInBytes: 30 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ adminId: admin.id, brand, contentType, filename: safeName, size }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || '{}');
        const db = sql();
        await db`INSERT INTO public.media_assets (brand, object_key, original_filename, content_type, size_bytes, created_by) VALUES (${payload.brand}, ${blob.pathname}, ${payload.filename || blob.pathname}, ${payload.contentType || blob.contentType || 'application/octet-stream'}, ${Number(payload.size) || 1}, ${payload.adminId}) ON CONFLICT (object_key) DO NOTHING`;
        await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id) VALUES (${payload.adminId}, 'media.upload', 'media', ${blob.pathname})`;
      }
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Media upload failed:', error?.message || 'unknown error');
    return res.status(400).json({ error: 'Could not authorize this upload.' });
  }
}
