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
  if (!shop) return null;
  if (shop.productChunkCount > 0 && !(shop.products || []).length) {
    const products = [];
    for (let i = 0; i < shop.productChunkCount; i++) {
      const chunk = await getDoc('metaShopChunks', `${shop.id}_${i}`);
      if (chunk?.products) products.push(...chunk.products);
    }
    shop = { ...shop, products };
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

async function loadPublishedNews() {
  const all = await listCollection('news');
  const now = Date.now();
  return all
    .filter(a => a.isPublished !== false && new Date(a.publishedAt).getTime() <= now)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
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
        const pubTime = new Date(article.publishedAt).getTime();
        if (pubTime <= Date.now()) {
          return {
            title: `${article.title?.trim() || 'خبر'} | ${defaults.siteName}`,
            description: truncate(article.metaDescription || article.summary || ''),
            image: absUrl(origin, article.coverImage || defaults.image),
            siteName: defaults.siteName,
            type: 'article',
            keywords: article.metaKeywords || (article.tags || []).join(', '),
          };
        }
      }
    } else {
      return {
        title: `اخبار و مقالات صادراتی | ${defaults.siteName}`,
        description: truncate('آخرین اخبار حوزه صادرات، بازرگانی، قوانین گمرکی، بازارهای هدف و راهنمای صادرات'),
        image: absUrl(origin, defaults.image),
        siteName: defaults.siteName,
        type: 'website',
      };
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

function articleUrl(origin, id) {
  return `${origin}/?page=news&id=${encodeURIComponent(id)}`;
}

function renderArticleBody(article, origin) {
  const url = articleUrl(origin, article.id);
  const img = article.coverImage
    ? `<figure><img src="${esc(article.coverImage)}" alt="${esc(article.title)}" style="max-width:100%;height:auto;border-radius:8px" /></figure>`
    : '';
  const tags = (article.tags || []).length
    ? `<p>${(article.tags || []).map(t => `<span>#${esc(t)}</span>`).join(' ')}</p>`
    : '';
  const content = esc(article.content || '').replace(/\n/g, '<br />');
  return `<article itemscope itemtype="https://schema.org/NewsArticle">
  <header>
    <p><a href="${esc(origin)}/?page=news">← بازگشت به اخبار</a></p>
    <h1 itemprop="headline">${esc(article.title)}</h1>
    <p><span itemprop="author">${esc(article.author || '')}</span> · <time itemprop="datePublished" datetime="${esc(article.publishedAt)}">${esc(article.publishedAt?.slice(0, 10) || '')}</time></p>
    ${article.category ? `<p>${esc(article.category)}</p>` : ''}
  </header>
  ${img}
  <p itemprop="description"><strong>${esc(article.summary || '')}</strong></p>
  <div itemprop="articleBody">${content}</div>
  ${tags}
  <p><a href="${esc(url)}">مشاهده در وبسایت</a></p>
</article>`;
}

function renderNewsListBody(articles, origin) {
  const items = articles.slice(0, 50).map(a => {
    const url = articleUrl(origin, a.id);
    return `<li>
      <article>
        <h2><a href="${esc(url)}">${esc(a.title)}</a></h2>
        <p>${esc(truncate(a.summary || '', 200))}</p>
        <p><small>${esc(a.author || '')} · ${esc(a.publishedAt?.slice(0, 10) || '')}</small></p>
      </article>
    </li>`;
  }).join('\n');
  return `<main>
  <h1>اخبار و مقالات صادراتی</h1>
  <p>آخرین اخبار حوزه صادرات، بازرگانی، قوانین گمرکی و بازارهای هدف</p>
  <ul style="list-style:none;padding:0">${items}</ul>
</main>`;
}

function articleJsonLd(article, origin) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.metaDescription || article.summary || '',
    image: article.coverImage ? [article.coverImage] : undefined,
    datePublished: article.publishedAt,
    author: { '@type': 'Person', name: article.author || 'توحید دیهمی' },
    publisher: { '@type': 'Organization', name: 'پلتفرم توحید دیهمی' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl(origin, article.id) },
    keywords: (article.tags || []).join(', ') || undefined,
  });
}

function newsListJsonLd(articles, origin) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'اخبار و مقالات صادراتی',
    description: 'آخرین اخبار حوزه صادرات و بازرگانی',
    url: `${origin}/?page=news`,
    hasPart: articles.slice(0, 20).map(a => ({
      '@type': 'NewsArticle',
      headline: a.title,
      url: articleUrl(origin, a.id),
      datePublished: a.publishedAt,
    })),
  });
}

async function resolveCrawlerContent(params, origin) {
  if (params.get('page') !== 'news') return {};

  const newsId = params.get('id');
  if (newsId) {
    const article = await getDoc('news', newsId);
    if (!article || article.isPublished === false) return {};
    if (new Date(article.publishedAt).getTime() > Date.now()) return {};
    return {
      bodyHtml: renderArticleBody(article, origin),
      jsonLd: articleJsonLd(article, origin),
    };
  }

  const articles = await loadPublishedNews();
  return {
    bodyHtml: renderNewsListBody(articles, origin),
    jsonLd: newsListJsonLd(articles, origin),
  };
}

function renderHtml(meta, canonicalUrl, forCrawler = true, extras = {}) {
  const { title, description, image, siteName, type, keywords } = meta;
  const { bodyHtml, jsonLd } = extras;
  const appUrl = humanAppUrl(canonicalUrl);
  const defaultBody = `<p><a href="${esc(appUrl)}">${esc(title)}</a></p>`;
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index, follow" />
  <title>${esc(title)}</title>
  ${description ? `<meta name="description" content="${esc(description)}" />` : ''}
  ${keywords ? `<meta name="keywords" content="${esc(keywords)}" />` : ''}
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
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
  ${forCrawler ? '' : `<meta http-equiv="refresh" content="0;url=${esc(appUrl)}" />`}
  <style>
    body { font-family: Tahoma, 'Segoe UI', sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; color: #1d1d1f; }
    h1 { font-size: 1.75rem; line-height: 1.4; }
    h2 { font-size: 1.1rem; margin: 1.5rem 0 0.25rem; }
    a { color: #2563eb; }
    img { margin: 1rem 0; }
  </style>
</head>
<body>
  ${bodyHtml || defaultBody}
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
    const crawlerExtras = forCrawler ? await resolveCrawlerContent(params, origin) : {};
    const html = renderHtml(meta, canonicalUrl, forCrawler, crawlerExtras);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send(`<!-- og-meta error: ${esc(String(e))} -->`);
  }
}
