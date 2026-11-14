/**
 * Public custom Meta Shop storefront.
 * GET /s/:slug        → uploaded HTML, or the ZIP entry page
 * GET /s/:slug/:path  → a file inside the ZIP
 * Order posts are rewritten to /api/meta-shop-order?shop=<slug>
 */

import JSZip from 'jszip';

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css',
  js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain; charset=utf-8', mp4: 'video/mp4', webm: 'video/webm',
};

function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = parseValue(v);
  return obj;
}
function parseValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  return null;
}
function parseDoc(doc) {
  const id = String(doc.name || '').split('/').pop();
  return { id, ...parseFields(doc.fields || {}) };
}

async function getDoc(col, id) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields ? parseDoc(d) : null;
}

async function queryByField(col, field, value) {
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        limit: 1,
      },
    }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  const doc = rows?.[0]?.document;
  return doc?.fields ? parseDoc(doc) : null;
}

async function findShop(slug) {
  const byId = await getDoc('metaShops', slug);
  if (byId && (byId.slug === slug || byId.id === slug)) return byId;
  return queryByField('metaShops', 'slug', slug);
}

function originFromReq(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.tohiddayhami.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
}

function pathFromReq(req) {
  const q = req.query.path;
  if (Array.isArray(q)) return normalizePath(q.filter(Boolean).join('/'));
  if (q) return normalizePath(String(q));
  return '';
}

function mimeFor(path) {
  const ext = String(path.split('.').pop() || '').toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function page(title, message) {
  return `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a"><div style="text-align:center;padding:24px"><h1 style="font-size:20px">${title}</h1><p>${message}</p></div></body></html>`;
}

function injectOrderBridge(html, { slug, origin, filePath }) {
  const endpoint = `${origin}/api/meta-shop-order?shop=${encodeURIComponent(slug)}`;
  let out = String(html || '');
  out = out.replace(/const\s+SUBMIT_URL\s*=\s*[^;]+;/, `const SUBMIT_URL=${JSON.stringify(endpoint)};`);
  if (filePath && !/<base\s/i.test(out)) {
    const dir = filePath.includes('/') ? filePath.replace(/\/[^/]+$/, '/') : '';
    const base = `${origin}/s/${encodeURIComponent(slug)}/${dir}`;
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${base}">`);
  }
  const script = `<script>(function(){
    var SHOP=${JSON.stringify(slug)};
    var ORDER=${JSON.stringify(endpoint)};
    var orig=window.fetch;
    window.fetch=function(u,o){
      try{
        var s=String(typeof u==="string"?u:(u&&u.url)||"");
        var ours=s.indexOf("/api/meta-shop-order")>=0||s.indexOf("/api/html-form")>=0||s.indexOf("/api/hosted-pack")>=0||s.indexOf("/api/arka-forms")>=0;
        if(ours && o && typeof o.body==="string"){
          try{
            var j=JSON.parse(o.body);
            j.shopSlug=j.shopSlug||SHOP;
            if(j.data && typeof j.data==="object" && !Array.isArray(j.data)) j.data.shopSlug=j.data.shopSlug||SHOP;
            o=Object.assign({},o,{body:JSON.stringify(j)});
          }catch(e){}
          if(s.indexOf("/api/meta-shop-order")<0) return orig(ORDER, Object.assign({},o,{method:"POST"}));
        }
      }catch(e){}
      return orig.apply(this, arguments);
    };
  })();<\/script>`;
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${script}</body>`);
  return `${out}\n${script}`;
}

let zipCache = { url: '', zip: null };
async function loadZip(url) {
  if (zipCache.url === url && zipCache.zip) return zipCache.zip;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`zip_fetch_${r.status}`);
  const zip = await JSZip.loadAsync(Buffer.from(await r.arrayBuffer()));
  zipCache = { url, zip };
  return zip;
}

function zipFiles(zip) {
  return Object.keys(zip.files || {}).filter(n => zip.files[n] && !zip.files[n].dir);
}

function findEntry(zip, logical) {
  const names = zipFiles(zip);
  const want = normalizePath(logical).toLowerCase();
  if (want) {
    const hit = names.find(n => normalizePath(n).toLowerCase() === want)
      || names.find(n => normalizePath(n).toLowerCase().endsWith(`/${want}`));
    if (hit) return zip.files[hit];
  }
  const html = names.find(n => /(?:^|\/)index\.html?$/i.test(n))
    || names.find(n => /\.html?$/i.test(n));
  return html ? zip.files[html] : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('method_not_allowed');
  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(400).send('shop slug required');

  try {
    const shop = await findShop(slug);
    if (!shop || shop.isActive === false || !shop.storefrontKind) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(page('فروشگاه یافت نشد', 'این ویترین هنوز بارگذاری نشده است.'));
    }
    const origin = originFromReq(req);
    const requested = pathFromReq(req);

    if (shop.storefrontKind === 'html') {
      if (!shop.storefrontHtmlUrl) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(page('فایل نیست', 'فایل HTML این فروشگاه ذخیره نشده.'));
      }
      const r = await fetch(shop.storefrontHtmlUrl);
      if (!r.ok) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(502).send(page('خطا', 'خواندن فایل فروشگاه ناموفق بود.'));
      }
      const html = injectOrderBridge(await r.text(), { slug: shop.slug || slug, origin, filePath: '' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(html);
    }

    if (!shop.storefrontPackZipUrl) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(page('فایل نیست', 'بسته ZIP این فروشگاه ذخیره نشده.'));
    }
    const zip = await loadZip(shop.storefrontPackZipUrl);
    const logical = requested || shop.storefrontPackEntry || 'index.html';
    const entry = findEntry(zip, logical);
    if (!entry) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(page('فایل نیست', 'این مسیر داخل بسته وجود ندارد.'));
    }
    const name = entry.name || logical;
    const bytes = await entry.async('nodebuffer');
    if (!/\.html?$/i.test(name)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', mimeFor(name));
      return res.status(200).send(bytes);
    }
    const html = injectOrderBridge(bytes.toString('utf8'), { slug: shop.slug || slug, origin, filePath: normalizePath(name) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send(String(e && e.message ? e.message : e));
  }
}
