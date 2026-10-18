import { sql, requireAdmin } from '../_auth.js';
const valid = new Set(['home', 'pixel-studios', 'nira-editorial']);
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return res.status(401).json({ error: 'Sign in required.' });
  const db = sql();
  if (req.method === 'GET') {
    const rows = await db`SELECT page_key, title, draft_content, published_content, status, updated_at, published_at FROM public.site_pages ORDER BY page_key`;
    return res.status(200).json({ pages: rows });
  }
  if (req.method !== 'PUT' && req.method !== 'POST') { res.setHeader('Allow', 'GET, PUT, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const { pageKey, title, content, action } = req.body || {};
  if (!valid.has(pageKey) || typeof title !== 'string' || !title.trim() || !content || typeof content !== 'object' || Array.isArray(content)) return res.status(400).json({ error: 'Invalid page data.' });
  if (action === 'publish') {
    const rows = await db`INSERT INTO public.site_pages (page_key, title, draft_content, published_content, status, updated_by, updated_at, published_at) VALUES (${pageKey}, ${title.trim()}, ${JSON.stringify(content)}::jsonb, ${JSON.stringify(content)}::jsonb, 'published', ${admin.id}, now(), now()) ON CONFLICT (page_key) DO UPDATE SET title=EXCLUDED.title, draft_content=EXCLUDED.draft_content, published_content=EXCLUDED.published_content, status='published', updated_by=EXCLUDED.updated_by, updated_at=now(), published_at=now() RETURNING page_key, status, updated_at, published_at`;
    await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id) VALUES (${admin.id}, 'page.publish', 'page', ${pageKey})`;
    return res.status(200).json({ page: rows[0] });
  }
  const rows = await db`INSERT INTO public.site_pages (page_key, title, draft_content, status, updated_by, updated_at) VALUES (${pageKey}, ${title.trim()}, ${JSON.stringify(content)}::jsonb, 'draft', ${admin.id}, now()) ON CONFLICT (page_key) DO UPDATE SET title=EXCLUDED.title, draft_content=EXCLUDED.draft_content, status=CASE WHEN public.site_pages.status='published' THEN 'published' ELSE 'draft' END, updated_by=EXCLUDED.updated_by, updated_at=now() RETURNING page_key, status, updated_at`;
  await db`INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id) VALUES (${admin.id}, 'page.save_draft', 'page', ${pageKey})`;
  return res.status(200).json({ page: rows[0] });
}
