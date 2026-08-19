/**
 * Dynamic sitemap — includes published news articles from Firestore.
 * Served at /sitemap.xml (see vercel.json rewrite).
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = 'https://www.tohiddayhami.com';

function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = parseValue(v);
  return obj;
}

function parseValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  return null;
}

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  return { id, ...parseFields(doc.fields || {}) };
}

async function listCollection(col) {
  const docs = [];
  let pageToken;
  do {
    const qs = new URLSearchParams({ pageSize: '200', key: API_KEY });
    if (pageToken) qs.set('pageToken', pageToken);
    const r = await fetch(`${BASE}/${col}?${qs}`);
    if (!r.ok) break;
    const data = await r.json();
    for (const doc of data.documents || []) docs.push(parseDoc(doc));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toLastmod(iso) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${escXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function isPublishedArticle(a) {
  if (a.isPublished === false) return false;
  try {
    return new Date(a.publishedAt).getTime() <= Date.now();
  } catch {
    return true;
  }
}

export default async function handler(_req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];

  entries.push(urlEntry(`${SITE}/`, today, 'weekly', '1.0'));
  entries.push(urlEntry(`${SITE}/?page=news`, today, 'daily', '0.9'));
  entries.push(urlEntry(`${SITE}/?page=form`, today, 'monthly', '0.7'));
  entries.push(urlEntry(`${SITE}/?page=tracking`, today, 'monthly', '0.5'));
  entries.push(urlEntry(`${SITE}/?shops=1`, today, 'weekly', '0.7'));
  entries.push(urlEntry(`${SITE}/?page=booking`, today, 'monthly', '0.6'));

  try {
    const articles = await listCollection('news');
    const published = articles
      .filter(isPublishedArticle)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    for (const a of published) {
      entries.push(urlEntry(
        `${SITE}/?page=news&id=${encodeURIComponent(a.id)}`,
        toLastmod(a.publishedAt),
        'weekly',
        '0.8',
      ));
    }

    const shops = await listCollection('metaShops');
    for (const s of shops) {
      if (s.isActive === false || !s.slug) continue;
      entries.push(urlEntry(
        `${SITE}/?shop=${encodeURIComponent(s.slug)}`,
        today,
        'weekly',
        '0.7',
      ));
    }
  } catch {
    // Static pages still included if Firestore fails.
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
  return res.status(200).send(xml);
}
