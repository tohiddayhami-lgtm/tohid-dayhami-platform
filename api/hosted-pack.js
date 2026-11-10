/**
 * Host ZIP flipbooks / multi-file HTML packs uploaded in Forms.
 *
 * GET  /p/:slug/...        → file from Firebase Storage (HTML injected)
 * POST /api/hosted-pack    → form submit → /api/html-form
 * POST /api/arka-forms     → alias
 */

import JSZip from 'jszip';

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
  otf: 'font/otf',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  map: 'application/json',
  webmanifest: 'application/manifest+json',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  glb: 'model/gltf-binary',
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

function normName(p) {
  return normalizePath(p).toLowerCase();
}

function stripOneFolder(p) {
  const n = normalizePath(p);
  const i = n.indexOf('/');
  return i === -1 ? n : n.slice(i + 1);
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
    tryPaths.push('magazine/index.html');
    tryPaths.push('go/index.html');
    tryPaths.push('index.html');
  }
  return [...new Set(tryPaths.filter(Boolean))];
}

function resolveLogicalPath(form, requested) {
  const files = Array.isArray(form.packFiles) ? form.packFiles : [];
  const listed = new Set(files.map(f => normalizePath(f && f.path)).filter(Boolean));
  const tries = candidatePaths(form, requested);
  for (const p of tries) {
    if (!listed.size || listed.has(p) || listed.has(stripOneFolder(p))) return p;
  }
  return tries[0] || normalizePath(form.packEntry || '') || 'index.html';
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
  const zip = await JSZip.loadAsync(buf);
  zipCache = { url, zip };
  return zip;
}

function zipFileList(zip) {
  return Object.keys(zip.files || {}).filter(n => zip.files[n] && !zip.files[n].dir);
}

function zipEntry(zip, logical, root) {
  const names = zipFileList(zip);
  const want = normName(logical);
  const prefixed = root ? normName(`${root}/${logical}`) : '';
  const score = (n) => {
    const nn = normName(n);
    if (nn === want || nn === prefixed) return 0;
    if (stripOneFolder(nn) === want) return 1;
    if (want && (nn.endsWith(`/${want}`) || nn.endsWith(want))) return 2;
    return 99;
  };
  const ranked = names.map(n => ({ n, s: score(n) })).filter(x => x.s < 99).sort((a, b) => a.s - b.s);
  if (ranked.length) return zip.files[ranked[0].n];
  if (!want || want.endsWith('index.html') || !want.includes('.')) {
    const html = names.find(n => /(?:^|\/)index\.html$/i.test(n) && n.split('/').filter(Boolean).length <= 2)
      || names.find(n => /(?:^|\/)magazine\/index\.html$/i.test(n))
      || names.find(n => /(?:^|\/)index\.html$/i.test(n))
      || names.find(n => /\.html?$/i.test(n))
      || names.find(n => /\.pdf$/i.test(n));
    if (html) return zip.files[html];
  }
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
  const endpoint = `${origin}/api/html-form`;
  const upload = `${origin}/api/html-form-file`;
  const script = `<script>(function(){
    var ID=${JSON.stringify(formId)};
    var ENDPOINT=${JSON.stringify(endpoint)};
    var UPLOAD=${JSON.stringify(upload)};
    var orig=window.fetch;
    window.fetch=function(u,o){
      try{
        var s=String(typeof u==="string"?u:(u&&u.url)||"");
        var ours=s.indexOf("/api/hosted-pack")>=0||s.indexOf("/api/html-form")>=0||s.indexOf("/api/arka-forms")>=0;
        if(ours && o && typeof FormData!=="undefined" && o.body instanceof FormData){
          return (async function(){
            var fd=o.body;
            var raw=fd.get("data");
            var data={};
            try{ data=typeof raw==="string"?JSON.parse(raw):(raw&&typeof raw==="object"?raw:{}); }catch(e){ data={}; }
            var files=[];
            var photos=[].concat(fd.getAll("photos[]")||[], fd.getAll("photos")||[]);
            for(var i=0;i<photos.length;i++){
              var f=photos[i];
              if(!f||!f.name) continue;
              var b64=await new Promise(function(res,rej){ var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||"").split(",")[1]||""); }; fr.onerror=rej; fr.readAsDataURL(f); });
              var up=await orig(UPLOAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({formId:ID,filename:String(f.name).slice(-80),contentType:f.type||"image/jpeg",data:b64})});
              var j=await up.json().catch(function(){return {};});
              if(j.url) files.push({name:f.name,type:f.type||"image/jpeg",size:f.size||0,content:j.url,label:"عکس پیوست"});
            }
            return orig(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({formId:ID,data:data,files:files})});
          })();
        }
        if(ours && o && typeof o.body==="string"){
          try{ var j=JSON.parse(o.body); j.formId=j.formId||ID; o=Object.assign({},o,{body:JSON.stringify(j)}); }catch(e){}
        }
      }catch(e){}
      return orig.apply(this,arguments);
    };
  })();<\/script>`;
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${script}</body>`);
  return `${out}\n${script}`;
}

function closedPage(title, message) {
  return `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a"><div style="text-align:center;padding:24px"><h1 style="font-size:20px">${title}</h1><p>${message}</p></div></body></html>`;
}

function flattenSubmit(payload) {
  let inner = payload.data;
  if (typeof inner === 'string') {
    try { inner = JSON.parse(inner); } catch { inner = {}; }
  }
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) inner = {};
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
      const files = Array.isArray(payload.files) ? payload.files : (Array.isArray(data.files) ? data.files : []);
      const r = await fetch(`${origin}/api/html-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, data, files }),
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
      let entry = zipEntry(zip, logical, form.packRoot);
      const missingLooksLikeRoute = !requested || !/\.[a-z0-9]{1,8}$/i.test(requested) || isHtml(logical);
      if (!entry && missingLooksLikeRoute) {
        entry = zipEntry(zip, form.packEntry || 'index.html', form.packRoot)
          || zipEntry(zip, '', form.packRoot);
      }
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
