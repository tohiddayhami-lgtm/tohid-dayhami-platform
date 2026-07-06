/**
 * Vercel serverless proxy for Google Sheets CSV export.
 * Iranian users often cannot reach docs.google.com directly.
 *
 * GET /api/sheets?url=<encoded Google Sheets CSV export URL>
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'missing_url' });
  }

  let target;
  try {
    target = decodeURIComponent(rawUrl);
  } catch {
    return res.status(400).json({ error: 'invalid_url' });
  }

  if (!target.startsWith('https://docs.google.com/spreadsheets/')) {
    return res.status(400).json({ error: 'url_must_be_google_sheets' });
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Tohid-Dayhami-Platform/1.0' },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const hint = upstream.status === 403
        ? 'sheet_not_public'
        : upstream.status === 404
          ? 'sheet_not_found'
          : `upstream_${upstream.status}`;
      return res.status(502).json({ error: hint });
    }

    const text = await upstream.text();
    if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
      return res.status(502).json({
        error: 'sheet_not_public',
        message: 'Sheet returned HTML instead of CSV — publish it or set sharing to anyone with the link.',
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed', message: String(e?.message || e) });
  }
}
