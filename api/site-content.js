import { sql } from './_auth.js';

const valid = new Set(['home', 'pixel-studios', 'nira-editorial']);
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', 'same-origin');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const pageKey = String(req.query?.pageKey || '');
  if (!valid.has(pageKey)) return res.status(400).json({ error: 'Invalid page.' });
  try {
    const db = sql();
    const rows = await db`SELECT published_content FROM public.site_pages WHERE page_key = ${pageKey} AND status = 'published' LIMIT 1`;
    return res.status(200).json({ content: rows[0]?.published_content || null });
  } catch (error) {
    console.error('Public page content unavailable:', error?.message || 'unknown error');
    return res.status(200).json({ content: null });
  }
}
