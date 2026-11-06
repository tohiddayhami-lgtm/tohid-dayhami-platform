/**
 * Host ZIP flipbooks / multi-file HTML packs uploaded in Forms.
 *
 * GET  /p/:slug/...        → file from Firebase Storage (HTML injected)
 * POST /api/hosted-pack    → form submit → /api/html-form
 * POST /api/arka-forms     → alias
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const MIME = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
};

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

async function getDoc(col, id) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields ? parseDoc(d) : null;
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

async function queryByField(col, field, value) {
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  const doc = rows?.[0]?.document;
  return doc?.fields ? parseDoc(doc) : null;
}

function slugifyFormName(s) {
  const ascii = String(s || '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return ascii || 'form';
}

function formPublicSlug(form) {
  if (form.slug && String(form.slug).trim()) return String(form.slug).trim();
  const fromEn = slugifyFormName(form.titleEn || '');
  if (fromEn !== 'form') return fromEn;
  const fromTitle = slugifyFormName(form.title || '');
  if (fromTitle !== 'form') return fromTitle;
  return slugifyFormName(form.id || 'form');
}

async function findFormByRef(ref) {
  const key = String(ref || '').trim();
  if (!key) return null;
  const byId = await getDoc('custom_forms', key);
  if (byId) return byId;
  const bySlug = await queryByField('custom_forms', 'slug', key);
  if (bySlug) return bySlug;
  const all = await listCollection('custom_forms');
  return all.find(f => formPublicSlug(f) === key.toLowerCase()) || null;
}

function originFromReq(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.tohiddayhami.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function normalizePath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
}

function pathFromReq(req) {
  const q = req.query.path;
  if (Array.isArray(q)) return normalizePath(q.filter(Boolean).join('/'));
  if (q) return normalizePath(String(q));
  const url = String(req.url || '');
  const m = url.match(/\/p\/[^/?#]+\/([^?#]*)/);
  if (m) return normalizePath(decodeURIComponent(m[1]));
  return '';
}

function mimeFor(path) {
  const ext = String(path.split('.').pop() || '').toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function isHtml(path) {
  return /\.html?$/i.test(path);
}

function candidatePaths(form, requested) {
  const tryPaths = [];
  const req = normalizePath(requested);
  if (req) tryPaths.push(req);
  if (req && !/\.[a-z0-9]+$/i.test(req)) {
    tryPaths.push(`${req}/index.html`);
    tryPaths.push(`${req}.html`);
  }
  if (!req) {
    tryPaths.push(normalizePath(form.packEntry || ''));
    tryPaths.push('go/index.html');
    tryPaths.push('index.html');
    tryPaths.push('magazine/index.html');
  }
  return tryPaths.filter(Boolean);
}

function resolveLogicalPath(form, requested) {
  const listed = new Set((Array.isArray(form.packFiles) ? form.packFiles : []).map(f => normalizePath(f.path)));
  const tries = candidatePaths(form, requested);
  for (const p of tries) {
    if (!listed.size || listed.has(p)) return p;
  }
  return tries[0] || '';
}

function resolveLegacyFile(form, logical) {
  const files = Array.isArray(form.packFiles) ? form.packFiles : [];
  return files.find(f => normalizePath(f.path) === logical && f.url) || null;
}

let zipCache = { url: '', zip: null };

async function loadPackZip(url) {
  if (zipCache.url === url && zipCache.zip) return zipCache.zip;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`zip_fetch_${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mod = await import('jszip');
  const JSZip = mod.default || mod;
  const zip = await JSZip.loadAsync(buf);
  zipCache = { url, zip };
  return zip;
}

function zipEntry(zip, logical, root) {
  const tries = [logical];
  if (root) tries.push(`${root}/${logical}`);
  tries.push(`arka/${logical}`);
  for (const t of tries) {
    const f = zip.file(t);
    if (f && !f.dir) return f;
  }
  const want = String(logical || '').replace(/\\/g, '/').toLowerCase();
  const names = Object.keys(zip.files || {});
  const hit = names.find(n => {
    const nn = String(n).replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    return nn === want || nn.endsWith(`/${want}`) || (root && nn === `${String(root).toLowerCase()}/${want}`);
  });
  if (hit && zip.files[hit] && !zip.files[hit].dir) return zip.file(hit);
  return null;
}

function dirHref(origin, slug, filePath) {
  const dir = filePath.includes('/') ? filePath.replace(/\/[^/]+$/, '/') : '';
  return `${origin}/p/${encodeURIComponent(slug)}/${dir}`;
}

function injectPackHtml(html, { formId, origin, slug, filePath, favicon }) {
  let out = String(html || '');
  out = out.replace(/const\s+SUBMIT_URL\s*=\s*(['"])[^'"]*\1/, `const SUBMIT_URL="${origin}/api/hosted-pack"`);
  if (!/<base\s/i.test(out)) {
    const base = dirHref(origin, slug, filePath);
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${base}">`);
  }
  if (favicon && !/rel=["']icon["']/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<link rel="icon" href="${favicon}">`);
  }
  const script = `<script>(function(){var ID=${JSON.stringify(formId)};var orig=window.fetch;window.fetch=function(u,o){try{var s=String(typeof u==="string"?u:(u&&u.url)||"");if(s.indexOf("/api/hosted-pack")>=0||s.indexOf("/api/arka-forms")>=0){o=o||{};if(typeof o.body==="string"){var j=JSON.parse(o.body);j.formId=ID;o=Object.assign({},o,{body:JSON.stringify(j)});}}}catch(e){}return orig.apply(this,arguments);};})();<\/script>`;
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${script}</body>`);
  return `${out}\n${script}`;
}

function closedPage(title, message) {
  return `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a"><div style="text-align:center;padding:24px"><h1 style="font-size:20px">${title}</h1><p>${message}</p></div></body></html>`;
}

function flattenSubmit(payload) {
  const inner = payload.data && typeof payload.data === 'object' ? payload.data : {};
  return {
    ...inner,
    form: payload.form || inner.form,
    lang: payload.lang || inner.lang,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const origin = originFromReq(req);

  try {
    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (payload.honeypot) return res.status(200).json({ ok: true, tracking_code: 'ARK-000000' });
      const formId = String(payload.formId || payload.packId || '').trim();
      if (!formId) return res.status(400).json({ ok: false, error: 'formId required' });
      const data = flattenSubmit(payload);
      const r = await fetch(`${origin}/api/html-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, data }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ ok: false, ...json });
      const tracking = String(json.ticketId || '').replace(/^HTML-/, 'ARK-') || `ARK-${Date.now().toString().slice(-6)}`;
      return res.status(200).json({ ok: true, tracking_code: tracking, ticketId: json.ticketId });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

    const ref = String(req.query.slug || req.query.id || '').trim();
    if (!ref) return res.status(400).send('pack slug required');
    const form = await findFormByRef(ref);
    if (!form || form.kind !== 'pack' || form.isPublic === false) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(closedPage('یافت نشد', 'این فایل در دسترس نیست.'));
    }
    if (form.isClosed) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(closedPage(form.title || 'بسته', form.closedMessage || 'این لینک بسته شده است.'));
    }

    const requested = pathFromReq(req);
    const logical = resolveLogicalPath(form, requested);
    if (!logical) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(closedPage('فایل نیست', 'این مسیر داخل بسته وجود ندارد.'));
    }

    let bytes = null;
    const legacy = resolveLegacyFile(form, logical);
    if (form.packZipUrl) {
      const zip = await loadPackZip(form.packZipUrl);
      const entry = zipEntry(zip, logical, form.packRoot);
      if (!entry) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(closedPage('فایل نیست', 'این مسیر داخل بسته وجود ندارد.'));
      }
      bytes = await entry.async('nodebuffer');
    } else if (legacy?.url) {
      if (!isHtml(logical)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Type', mimeFor(logical));
        return res.redirect(302, legacy.url);
      }
      const fetched = await fetch(legacy.url);
      if (!fetched.ok) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(502).send(closedPage('خطا', 'نتوانستیم فایل را بخوانیم.'));
      }
      bytes = Buffer.from(await fetched.arrayBuffer());
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(closedPage('فایل نیست', 'بسته هنوز آپلود نشده.'));
    }

    if (!isHtml(logical)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', mimeFor(logical));
      return res.status(200).send(bytes);
    }

    const cfg = await getDoc('settings', 'appConfig');
    const html = bytes.toString('utf8');
    const slug = formPublicSlug(form);
    const injected = injectPackHtml(html, {
      formId: form.id,
      origin,
      slug,
      filePath: logical,
      favicon: cfg?.favicon || '',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(injected);
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
