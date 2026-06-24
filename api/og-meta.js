/**
 * Dynamic Open Graph HTML for social crawlers (WhatsApp, Telegram, Facebook, …).
 * Vercel rewrites bot requests here (see vercel.json).
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const BOT_UA = /facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|ia_archiver/i;

function isBrowserNavigation(req) {
  const mode = req.headers['sec-fetch-mode'];
  const dest = req.headers['sec-fetch-dest'];
  const user = req.headers['sec-fetch-user'];
  if (mode === 'navigate' || dest === 'document' || user === '?1') return true;
  return false;
}

function isPreviewCrawler(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (BOT_UA.test(ua)) return true;
  if (/^WhatsApp\/\d/i.test(ua) && !isBrowserNavigation(req)) return true;
  return false;
}

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

async function loadShopBySlug(slug) {
  let shop = await queryByField('metaShops', 'slug', slug);
  if (!shop) {
    const all = await listCollection('metaShops');
    shop = all.find(s => s.slug === slug) || null;
  }
  return shop;
}

function truncate(s, max = 160) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absUrl(origin, url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${origin.replace(/\/$/, '')}/${String(url).replace(/^\//, '')}`;
}

async function loadSiteDefaults() {
  const cfg = await getDoc('settings', 'appConfig');
  return {
    title: cfg?.seoTitle || cfg?.ogTitle || cfg?.appTitle || 'پلتفرم توحید دیهمی',
    description: cfg?.seoDescription || cfg?.ogDescription || cfg?.appSubtitle || '',
    image: cfg?.ogImage || cfg?.favicon || '',
    siteName: cfg?.appTitle || 'پلتفرم توحید دیهمی',
  };
}

function translateField(i18n, key, legacy, uiLang) {
  if (i18n?.[uiLang]?.[key]) return i18n[uiLang][key];
  if (uiLang !== 'en' && i18n?.en?.[key]) return i18n.en[key];
  if (uiLang !== 'fa' && uiLang !== 'en' && i18n?.fa?.[key]) return i18n.fa[key];
  return legacy || '';
}

function pickShopOgLang(shop, queryLang) {
  const q = (queryLang || '').trim();
  if (q && shop.i18n?.[q]) return q;
  if (shop.defaultLang && (shop.languages || []).some(l => l.code === shop.defaultLang)) return shop.defaultLang;
  if (shop.i18n?.en && (shop.i18n.en.title || shop.i18n.en.subtitle || shop.i18n.en.collectionText)) return 'en';
  if ((shop.languages || []).some(l => l.code === 'en')) return 'en';
  return shop.defaultLang || 'fa';
}

function metaFromShopDoc(shop, origin, queryLang) {
  const lang = pickShopOgLang(shop, queryLang);
  const name = translateField(shop.i18n, 'name', (shop.name || '').trim(), lang) || shop.name || shop.slug;
  const seoTitle = translateField(shop.i18n, 'seoTitle', (shop.seoTitle || '').trim(), lang);
  const seoDescription = translateField(shop.i18n, 'seoDescription', (shop.seoDescription || '').trim(), lang);
  const heroTitle = translateField(shop.i18n, 'title', (shop.title || '').trim(), lang);
  const subtitle = translateField(shop.i18n, 'subtitle', (shop.subtitle || '').trim(), lang);
  const collection = translateField(shop.i18n, 'collectionText', (shop.collectionText || '').trim(), lang);
  const title = seoTitle || name || heroTitle || shop.slug;
  const description = seoDescription || collection || subtitle
    || (shop.type === 'services' ? `Services — ${name}` : shop.type === 'realestate' ? `Real Estate — ${name}` : name);
  return {
    title,
    description: truncate(description),
    image: absUrl(origin, shop.seoImage || shop.logo || shop.coverImage),
    siteName: name,
    type: 'website',
  };
}

function searchParamsFromReq(req) {
  const parsed = new URL(req.url || '/', 'http://localhost');
  const p = parsed.searchParams;
  const q = req.query || {};
  for (const [k, v] of Object.entries(q)) {
    if (k === 'path' || k === '...') continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val != null && val !== '' && !p.has(k)) p.set(k, String(val));
  }
  return p;
}

async function resolveMeta(searchOrParams, origin) {
  const p = searchOrParams instanceof URLSearchParams
    ? searchOrParams
    : new URLSearchParams(searchOrParams.startsWith('?') ? searchOrParams : `?${searchOrParams}`);
  const defaults = await loadSiteDefaults();

  const shopSlug = p.get('shop') || p.get('c');
  if (shopSlug) {
    const shop = await loadShopBySlug(shopSlug);
    if (shop && shop.isActive !== false) {
      const productId = p.get('product') || p.get('p');
      if (productId) {
        const product = (shop.products || []).find(pr => pr.id === productId && pr.active !== false);
        if (product) {
          const lang = pickShopOgLang(shop, p.get('lang'));
          const shopName = translateField(shop.i18n, 'name', shop.name || '', lang) || shop.name;
          const pName = translateField(product.i18n, 'name', product.name || '', lang) || product.name || product.sku;
          const pDesc = translateField(product.i18n, 'description', product.description || '', lang) || product.description || '';
          return {
            title: `${pName} | ${shopName}`,
            description: truncate(pDesc || `${pName} — ${shopName}`),
            image: absUrl(origin, product.images?.[0] || shop.seoImage || shop.logo || shop.coverImage),
            siteName: shopName,
            type: 'product',
          };
        }
      }
      const meta = metaFromShopDoc(shop, origin, p.get('lang'));
      if (!meta.image && defaults.image) meta.image = absUrl(origin, defaults.image);
      return meta;
    }
  }

  const formId = p.get('form');
  if (formId) {
    const form = await getDoc('custom_forms', formId);
    if (form) {
      return {
        title: form.title?.trim() || 'فرم آنلاین',
        description: truncate(form.description?.trim() || form.category || 'ثبت درخواست آنلاین'),
        image: defaults.image,
        siteName: defaults.siteName,
        type: 'website',
      };
    }
  }

  if (p.get('page') === 'news') {
    const newsId = p.get('id');
    if (newsId) {
      const article = await getDoc('news', newsId);
      if (article && article.isPublished !== false) {
        return {
          title: article.title?.trim() || 'خبر',
          description: truncate(article.metaDescription || article.summary || ''),
          image: absUrl(origin, article.coverImage || defaults.image),
          siteName: defaults.siteName,
          type: 'article',
        };
      }
    }
  }

  const bazaarSlug = p.get('bazaar') || p.get('expo') || p.get('expo-map');
  if (bazaarSlug) {
    const bazaar = await queryByField('metaBazaars', 'slug', bazaarSlug);
    if (bazaar) {
      const expo = bazaar.expo;
      const title = (expo?.enabled && (expo.title?.fa || expo.title?.en))
        ? (expo.title?.fa || expo.title?.en)
        : bazaar.name;
      const description = expo?.subtitle?.fa || expo?.subtitle?.en
        || bazaar.subtitle?.fa || bazaar.subtitle?.en
        || `بازارچه ${bazaar.name}`;
      return {
        title: String(title || bazaar.name),
        description: truncate(String(description)),
        image: absUrl(origin, expo?.entranceArchMedia || bazaar.coverImage || defaults.image),
        siteName: bazaar.name || defaults.siteName,
        type: 'website',
      };
    }
  }

  return {
    title: defaults.title,
    description: truncate(defaults.description),
    image: absUrl(origin, defaults.image),
    siteName: defaults.siteName,
    type: 'website',
  };
}

function humanAppUrl(canonicalUrl) {
  const u = new URL(canonicalUrl);
  u.searchParams.set('_p', '1');
  return u.toString();
}

function renderHtml(meta, canonicalUrl, forCrawler = true) {
  const { title, description, image, siteName, type } = meta;
  const appUrl = humanAppUrl(canonicalUrl);
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  ${description ? `<meta name="description" content="${esc(description)}" />` : ''}
  <meta property="og:title" content="${esc(title)}" />
  ${description ? `<meta property="og:description" content="${esc(description)}" />` : ''}
  ${image ? `<meta property="og:image" content="${esc(image)}" />` : ''}
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:type" content="${esc(type || 'website')}" />
  ${siteName ? `<meta property="og:site_name" content="${esc(siteName)}" />` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${esc(title)}" />
  ${description ? `<meta name="twitter:description" content="${esc(description)}" />` : ''}
  ${image ? `<meta name="twitter:image" content="${esc(image)}" />` : ''}
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  ${forCrawler ? '' : `<meta http-equiv="refresh" content="0;url=${esc(appUrl)}" />`}
</head>
<body>
  <p><a href="${esc(appUrl)}">${esc(title)}</a></p>
  ${forCrawler ? '' : `<script>location.replace(${JSON.stringify(appUrl)});</script>`}
</body>
</html>`;
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.tohiddayhami.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${host}`;
  const params = searchParamsFromReq(req);
  const qs = params.toString();
  const canonicalUrl = qs ? `${origin}/?${qs}` : `${origin}/`;

  try {
    const meta = await resolveMeta(params, origin);
    const forCrawler = isPreviewCrawler(req);
    const html = renderHtml(meta, canonicalUrl, forCrawler);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send(`<!-- og-meta error: ${esc(String(e))} -->`);
  }
}
