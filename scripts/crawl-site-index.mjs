#!/usr/bin/env node
/**
 * Crawl & index public content for tohiddayhami.com
 * Excludes: admin, dashboard, personnel, customers, tickets, invoices, internal CRM data.
 *
 * Usage: node scripts/crawl-site-index.mjs
 * Output: site-index/
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'site-index');

const DOMAIN = 'tohiddayhami.com';
const BASE_ORIGINS = [
  `https://www.${DOMAIN}`,
  `https://${DOMAIN}`,
];

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const EXCLUDE_URL_PATTERNS = [
  /[#?].*admin/i,
  /[#/]admin/i,
  /[#?].*dashboard/i,
  /page=admin/i,
  /\/api\/fb\b.*col=(tickets|customers|personnel|invoices|expenses|system_logs|messages|tasks|kpis|sales_records|reports|objectives|analytics|notification_logs|customerAccounts|processes|teamBrainstorm|metaShopOrders|metaShopPropertyReferrals)/i,
];

const MEDIA_EXT = /\.(pdf|png|jpe?g|gif|webp|svg|avif|mp4|webm|mov|avi|mkv|mp3|wav|ogg|zip|rar|7z|docx?|xlsx?|pptx?|csv)(\?|$)/i;

// ── Firestore REST helpers ───────────────────────────────────────────────────

function parseValue(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  return null;
}

function parseFields(fields) {
  const o = {};
  for (const [k, fv] of Object.entries(fields || {})) o[k] = parseValue(fv);
  return o;
}

function parseDoc(doc) {
  const id = (doc.name || '').split('/').pop();
  return { id, ...parseFields(doc.fields || {}) };
}

async function fetchWithTimeout(url, opts = {}, ms = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function listCollection(col, pageSize = 300) {
  const items = [];
  let pageToken = '';
  const proxyUrl = `${BASE_ORIGINS[0]}/api/fb?col=${encodeURIComponent(col)}`;

  // Try website proxy first (works from Iran), then direct Firestore
  for (const source of ['proxy', 'direct']) {
    items.length = 0;
    pageToken = '';
    try {
      if (source === 'proxy') {
        const res = await fetchWithTimeout(proxyUrl, {}, 120000);
        if (!res.ok) throw new Error(`proxy ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          items.push(...data);
          return items;
        }
        throw new Error('proxy not array');
      }

      do {
        const url = new URL(`${FS_BASE}/${col}`);
        url.searchParams.set('key', API_KEY);
        url.searchParams.set('pageSize', String(pageSize));
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const res = await fetchWithTimeout(url.toString());
        if (!res.ok) throw new Error(`firestore ${res.status}`);
        const data = await res.json();
        for (const doc of data.documents || []) items.push(parseDoc(doc));
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return items;
    } catch (e) {
      if (source === 'direct') console.warn(`  ⚠ list ${col}: ${e.message}`);
    }
  }
  return items;
}

// ── URL / media utilities ────────────────────────────────────────────────────

function isExcludedUrl(url) {
  return EXCLUDE_URL_PATTERNS.some((re) => re.test(url));
}

function normalizeUrl(href, origin) {
  if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  try {
    const u = new URL(href, origin);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.toString().replace(/\/$/, '') || u.origin;
  } catch {
    return null;
  }
}

function isInScope(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === DOMAIN || h === `www.${DOMAIN}` || h.endsWith(`.${DOMAIN}`);
  } catch {
    return false;
  }
}

function absMediaUrl(url, origin) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/')) return `${origin}${t}`;
  return t;
}

function mediaType(url) {
  const lower = url.toLowerCase().split('?')[0];
  if (/\.pdf$/i.test(lower)) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(lower)) return 'image';
  if (/\.(mp4|webm|mov|avi|mkv)$/i.test(lower)) return 'video';
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)$/i.test(lower)) return 'audio';
  if (/\.(zip|rar|7z|tar|gz)$/i.test(lower)) return 'archive';
  if (/\.(docx?|xlsx?|pptx?|csv)$/i.test(lower)) return 'document';
  if (/firebasestorage\.googleapis\.com|cloudfront\.net/i.test(lower)) return 'hosted-media';
  return 'file';
}

function pageUrl(origin, query) {
  const q = query.startsWith('?') ? query.slice(1) : query;
  return `${origin.replace(/\/$/, '')}/?${q}`;
}

function walkObject(obj, fn, path = '') {
  if (obj == null) return;
  if (typeof obj === 'string') {
    fn(obj, path);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkObject(v, fn, `${path}[${i}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) walkObject(v, fn, path ? `${path}.${k}` : k);
  }
}

function extractUrlsFromHtml(html, origin) {
  const found = new Set();
  const patterns = [
    /href=["']([^"']+)["']/gi,
    /src=["']([^"']+)["']/gi,
    /content=["'](https?:\/\/[^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      const n = normalizeUrl(m[1], origin);
      if (n) found.add(n);
    }
  }
  return [...found];
}

async function crawlPage(url, visited, queue, mediaSet) {
  if (visited.has(url) || isExcludedUrl(url)) return;
  visited.add(url);

  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': BOT_UA } }, 15000);
    if (!res.ok) return;
    const ct = res.headers.get('content-type') || '';
    if (MEDIA_EXT.test(url)) {
      mediaSet.add(url);
      return;
    }
    if (!ct.includes('text/html') && !ct.includes('application/xml') && !ct.includes('text/plain')) {
      if (MEDIA_EXT.test(url) || mediaType(url) !== 'file') mediaSet.add(url);
      return;
    }
    const html = await res.text();
    const origin = new URL(url).origin;
    for (const link of extractUrlsFromHtml(html, origin)) {
      if (MEDIA_EXT.test(link) || !link.includes('?')) {
        if (MEDIA_EXT.test(link) || /\.(pdf|png|jpe?g|webp|mp4)/i.test(link)) mediaSet.add(link);
      }
      if (isInScope(link) && !isExcludedUrl(link)) {
        if (!visited.has(link)) queue.push(link);
      }
    }
    // og:image etc.
    const ogImg = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) mediaSet.add(absMediaUrl(ogImg[1], origin));
  } catch {
    /* skip unreachable */
  }
}

// ── Build inventories from Firestore ─────────────────────────────────────────

function sanitizeShopForIndex(shop) {
  const { editorPersonnelIds, assignedPersonnelIds, assignedDepartmentId, assignType, ...pub } = shop;
  return pub;
}

function sanitizeBazaarForIndex(bazaar) {
  return bazaar;
}

function sanitizeFormForIndex(form) {
  const { allowedRoles, allowedPersonnelIds, assigneePersonnelId, assigneeRole, createdBy, ...pub } = form;
  return pub;
}

function sanitizeArticle(article) {
  return article;
}

function collectMediaFromData(data, source, origin, mediaInventory) {
  walkObject(data, (str, path) => {
    if (typeof str !== 'string') return;
    const isUrl = /^https?:\/\//i.test(str) || str.includes('firebasestorage') || str.includes('cloudfront.net');
    const isMedia = isUrl && (MEDIA_EXT.test(str) || /youtube|vimeo|\.pdf/i.test(str) || path.match(/(image|logo|cover|url|media|video|pdf|banner|panel|audio|glb|model)/i));
    if (!isMedia) return;
    const abs = absMediaUrl(str, origin) || str;
    mediaInventory.push({
      url: abs,
      type: mediaType(abs),
      source,
      fieldPath: path,
    });
  });
}

async function main() {
  const origin = BASE_ORIGINS[0];
  const crawledAt = new Date().toISOString();
  console.log(`\n🔍 Indexing ${origin} (excluding admin/dashboard/internal CRM)\n`);

  mkdirSync(OUT_DIR, { recursive: true });

  // ── Fetch public Firestore collections ──
  console.log('📦 Fetching Firestore collections...');
  const [metaShops, metaBazaars, newsRaw, customForms, servicesDoc, consultantCategories, meetings] = await Promise.all([
    listCollection('metaShops'),
    listCollection('metaBazaars'),
    listCollection('news'),
    listCollection('custom_forms'),
    listCollection('settings').then((docs) => docs.find((d) => d.id === 'services') || null),
    listCollection('consultantCategories'),
    listCollection('meetings'),
  ]);

  const shops = metaShops.filter((s) => s.isActive !== false).map(sanitizeShopForIndex);
  const bazaars = metaBazaars.filter((b) => b.isActive !== false).map(sanitizeBazaarForIndex);
  const now = Date.now();
  const articles = newsRaw
    .filter((a) => a.isPublished !== false && new Date(a.publishedAt || 0).getTime() <= now)
    .map(sanitizeArticle);
  const publicForms = customForms.filter((f) => f.isPublic && !f.isClosed).map(sanitizeFormForIndex);
  const services = servicesDoc?.list?.filter((s) => s.isActive !== false) || [];

  console.log(`   shops=${shops.length} bazaars=${bazaars.length} news=${articles.length} forms=${publicForms.length} services=${services.length}`);

  // ── URL inventory ──
  const urlInventory = [];
  const addUrl = (loc, type, meta = {}) => {
    if (isExcludedUrl(loc)) return;
    urlInventory.push({ url: loc, type, ...meta });
  };

  const staticPages = [
    { q: '', type: 'page', title: 'Home / Landing' },
    { q: '?page=form', type: 'form', title: 'Customer request form' },
    { q: '?page=tracking', type: 'page', title: 'Request tracking' },
    { q: '?page=news', type: 'page', title: 'News listing' },
    { q: '?shops=1', type: 'page', title: 'Meta shops directory' },
    { q: '?page=booking', type: 'page', title: 'Consultation booking' },
    { q: '?page=consultation-track', type: 'page', title: 'Consultation tracking' },
    { q: '/sitemap.xml', type: 'sitemap', title: 'Sitemap' },
    { q: '/robots.txt', type: 'robots', title: 'Robots' },
  ];

  for (const p of staticPages) {
    const loc = p.q.startsWith('/')
      ? `${origin}${p.q}`
      : p.q === ''
        ? `${origin}/`
        : pageUrl(origin, p.q);
    addUrl(loc, p.type, { title: p.title });
  }

  for (const s of services) {
    addUrl(pageUrl(origin, `page=form&service=${s.id}`), 'form', { title: s.title, serviceId: s.id });
  }

  for (const a of articles) {
    addUrl(pageUrl(origin, `page=news&id=${a.id}`), 'post', {
      id: a.id,
      slug: a.slug,
      title: a.title,
      titleEn: a.titleEn,
      category: a.category,
      categories: a.categories,
      tags: a.tags || [],
      publishedAt: a.publishedAt,
      coverImage: a.coverImage,
    });
    // Legacy slug-based news links (#/news/<slug>) — kept for completeness
    if (a.slug) {
      addUrl(`${origin}/#/news/${encodeURIComponent(a.slug)}`, 'post', {
        id: a.id,
        slug: a.slug,
        title: a.title,
        legacy: true,
      });
    }
  }

  const allTags = new Set();
  const allCategories = new Set();
  const newsCategories = new Set();
  for (const a of articles) {
    (a.tags || []).forEach((t) => allTags.add(t));
    if (a.category) { allCategories.add(a.category); newsCategories.add(a.category); }
    (a.categories || []).forEach((c) => { allCategories.add(c); newsCategories.add(c); });
  }

  for (const f of publicForms) {
    addUrl(pageUrl(origin, `form=${f.id}`), 'form', { id: f.id, title: f.title, category: f.category });
  }

  for (const shop of shops) {
    addUrl(pageUrl(origin, `shop=${shop.slug}`), 'product-catalog', {
      slug: shop.slug,
      name: shop.name,
      shopType: shop.type,
      code: shop.code,
    });
    addUrl(pageUrl(origin, `shop=${shop.slug}&c=1`), 'product-catalog', {
      slug: shop.slug,
      name: shop.name,
      catalogMode: true,
    });
    (shop.directoryCats || []).forEach((c) => {
      if (c?.fa) allCategories.add(c.fa);
      if (c?.en) allCategories.add(c.en);
    });
    (shop.categories || []).forEach((c) => {
      const label = typeof c === 'string' ? c : c?.fa || c?.en;
      if (label) allCategories.add(label);
    });
    const activeProducts = (shop.products || []).filter((p) => p.active !== false);
    for (const p of activeProducts) {
      addUrl(pageUrl(origin, `shop=${shop.slug}&product=${p.id}`), 'product', {
        shopSlug: shop.slug,
        shopName: shop.name,
        productId: p.id,
        name: p.name,
        sku: p.sku,
        group: p.group,
        subcategory: p.subcategory,
        hsCode: p.hsCode,
        images: p.images || [],
      });
      if (p.group) allCategories.add(p.group);
      if (p.subcategory) allCategories.add(p.subcategory);
    }
    for (const pg of shop.pages || []) {
      addUrl(pageUrl(origin, `shop=${shop.slug}#page-${pg.id}`), 'page', {
        shopSlug: shop.slug,
        pageId: pg.id,
        name: pg.name || pg.nameEn,
      });
    }
  }

  for (const b of bazaars) {
    addUrl(pageUrl(origin, `bazaar=${b.slug}`), 'category', { slug: b.slug, name: b.name, kind: 'meta-bazaar' });
    if (b.expo?.enabled !== false && b.expo) {
      addUrl(pageUrl(origin, `expo=${b.slug}`), 'expo', { slug: b.slug, name: b.name, kind: 'virtual-exhibition' });
      addUrl(pageUrl(origin, `expo-map=${b.slug}`), 'map', { slug: b.slug, name: b.name, kind: 'expo-reservation-map' });
      addUrl(pageUrl(origin, `page=expo-map&bazaar=${b.slug}`), 'map', { slug: b.slug, name: b.name, kind: 'expo-reservation-map-alt' });
      for (const booth of b.expo.booths || []) {
        addUrl(pageUrl(origin, `expo=${b.slug}#booth-${booth.id}`), 'expo-booth', {
          bazaarSlug: b.slug,
          boothId: booth.id,
          shopSlug: booth.shopSlug,
        });
      }
    }
    const walkTree = (nodes) => {
      for (const n of nodes || []) {
        const label = n.label?.fa || n.label?.en;
        if (label) allCategories.add(label);
        walkTree(n.children);
      }
    };
    walkTree(b.tree);
  }

  // Public booking consultant deep links
  const openMeetings = (meetings || []).filter((m) => {
    const st = m.status || 'open';
    return (st === 'open' || st === 'pending') && m.date >= new Date().toISOString().slice(0, 10);
  });
  const consultantIds = new Set(openMeetings.map((m) => m.organizerId).filter(Boolean));
  for (const cid of consultantIds) {
    addUrl(pageUrl(origin, `page=booking&consultant=${cid}`), 'page', { kind: 'consultant-booking', consultantId: cid });
  }

  // API endpoints (discoverable through the website)
  const apiEndpoints = [
    { path: '/api/og-meta', method: 'GET', description: 'Open Graph HTML for social crawlers' },
    { path: '/api/fb', method: 'GET', description: 'Firestore read proxy (public collections)' },
    { path: '/api/meeting-reminder', method: 'GET', description: 'Meeting reminder cron' },
    { path: '/api/daily-summary', method: 'GET', description: 'Daily summary cron' },
  ];
  for (const api of apiEndpoints) {
    addUrl(`${origin}${api.path}`, 'api', api);
  }

  // ── Media inventory ──
  const mediaInventory = [];
  for (const shop of shops) collectMediaFromData(shop, `metashop:${shop.slug}`, origin, mediaInventory);
  for (const b of bazaars) collectMediaFromData(b, `bazaar:${b.slug}`, origin, mediaInventory);
  for (const a of articles) collectMediaFromData(a, `news:${a.id}`, origin, mediaInventory);

  // Dedupe media
  const mediaMap = new Map();
  for (const m of mediaInventory) {
    if (!mediaMap.has(m.url)) mediaMap.set(m.url, m);
  }
  const uniqueMedia = [...mediaMap.values()];

  // ── HTTP crawl (bot UA → og-meta pages) ──
  console.log('🕸️  Crawling internal links...');
  const visited = new Set();
  const queue = urlInventory.map((u) => u.url).filter((u) => isInScope(u));
  const crawledMedia = new Set(uniqueMedia.map((m) => m.url));

  let crawlCount = 0;
  const MAX_CRAWL = 500;
  while (queue.length > 0 && crawlCount < MAX_CRAWL) {
    const url = queue.shift();
    await crawlPage(url, visited, queue, crawledMedia);
    crawlCount++;
  }
  for (const m of crawledMedia) {
    if (!mediaMap.has(m)) mediaMap.set(m, { url: m, type: mediaType(m), source: 'http-crawl' });
  }
  const allMedia = [...mediaMap.values()];

  // Merge newly discovered in-scope URLs from crawl
  for (const u of visited) {
    if (!urlInventory.some((x) => x.url === u)) {
      addUrl(u, 'page', { source: 'http-crawl' });
    }
  }

  // ── Content inventory (structured) ──
  const contentInventory = {
    news: {
      listingUrl: pageUrl(origin, 'page=news'),
      count: articles.length,
      categories: [...newsCategories].sort(),
    },
    pages: urlInventory.filter((u) => u.type === 'page'),
    posts: articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      titleEn: a.titleEn,
      summary: a.summary,
      summaryEn: a.summaryEn,
      contentPreview: (a.content || '').slice(0, 500),
      category: a.category,
      categories: a.categories,
      tags: a.tags,
      publishedAt: a.publishedAt,
      author: a.author,
      url: pageUrl(origin, `page=news&id=${a.id}`),
      coverImage: a.coverImage,
      metaDescription: a.metaDescription,
      metaKeywords: a.metaKeywords,
    })),
    products: shops.flatMap((shop) =>
      (shop.products || []).filter((p) => p.active !== false).map((p) => ({
        id: p.id,
        shopSlug: shop.slug,
        shopName: shop.name,
        shopType: shop.type,
        name: p.name,
        sku: p.sku,
        group: p.group,
        subcategory: p.subcategory,
        hsCode: p.hsCode,
        description: (p.description || '').slice(0, 500),
        url: pageUrl(origin, `shop=${shop.slug}&product=${p.id}`),
        shopUrl: pageUrl(origin, `shop=${shop.slug}`),
        images: p.images || [],
        featured: !!p.featured,
        active: p.active !== false,
      })),
    ),
    categories: [...allCategories].sort().map((name) => ({ name, kind: 'discovered' })),
    tags: [...allTags].sort().map((name) => ({ name })),
    forms: publicForms.map((f) => ({
      id: f.id,
      title: f.title,
      category: f.category,
      fieldCount: (f.fields || []).length,
      url: pageUrl(origin, `form=${f.id}`),
    })),
    metaShops: shops.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      type: s.type,
      code: s.code,
      productCount: (s.products || []).length,
      url: pageUrl(origin, `shop=${s.slug}`),
    })),
    bazaars: bazaars.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      hasExpo: !!(b.expo?.enabled !== false && b.expo),
      boothCount: b.expo?.booths?.length || 0,
      urls: {
        bazaar: pageUrl(origin, `bazaar=${b.slug}`),
        expo: b.expo ? pageUrl(origin, `expo=${b.slug}`) : null,
        map: b.expo ? pageUrl(origin, `expo-map=${b.slug}`) : null,
      },
    })),
    expoPages: bazaars
      .filter((b) => b.expo?.enabled !== false && b.expo)
      .map((b) => ({
        bazaarSlug: b.slug,
        title: b.expo.title,
        subtitle: b.expo.subtitle,
        visualStyle: b.expo.visualStyle,
        boothCount: b.expo.booths?.length || 0,
        url: pageUrl(origin, `expo=${b.slug}`),
      })),
    maps: bazaars
      .filter((b) => b.expo?.enabled !== false && b.expo)
      .map((b) => ({
        bazaarSlug: b.slug,
        name: b.name,
        url: pageUrl(origin, `expo-map=${b.slug}`),
      })),
    services: services.map((s) => ({
      id: s.id,
      title: s.title,
      titleEn: s.titleEn,
      url: pageUrl(origin, `page=form&service=${s.id}`),
    })),
    apis: apiEndpoints.map((a) => ({ ...a, url: `${origin}${a.path}` })),
    consultantCategories: (consultantCategories || []).map((c) => ({
      id: c.id,
      nameFa: c.nameFa,
      nameEn: c.nameEn,
    })),
  };

  // ── Full assets JSON database ──
  const assetsDatabase = {
    meta: {
      domain: DOMAIN,
      origins: BASE_ORIGINS,
      crawledAt,
      excluded: ['admin', 'dashboard', 'personnel', 'customers', 'tickets', 'invoices', 'internal CRM'],
      stats: {
        urls: urlInventory.length,
        posts: contentInventory.posts.length,
        products: contentInventory.products.length,
        metaShops: contentInventory.metaShops.length,
        bazaars: contentInventory.bazaars.length,
        forms: contentInventory.forms.length,
        media: allMedia.length,
        categories: contentInventory.categories.length,
        tags: contentInventory.tags.length,
        httpCrawled: visited.size,
      },
    },
    urls: urlInventory,
    content: contentInventory,
    media: allMedia,
    raw: {
      metaShops: shops,
      metaBazaars: bazaars,
      news: articles,
      customForms: publicForms,
      services,
    },
  };

  // ── Sitemap XML ──
  const sitemapUrls = [...new Set(urlInventory.map((u) => u.url))].filter(
    (u) => !u.includes('/api/') && !u.includes('#') && !u.endsWith('.xml') && !u.endsWith('.txt'),
  );
  const sitemapPriority = (url) => {
    if (url.endsWith('/') || url.endsWith('.com')) return '1.0';
    if (url.includes('page=news') && !url.includes('id=')) return '0.9';
    if (url.includes('page=news&id=')) return '0.8';
    if (url.includes('product=')) return '0.7';
    if (url.includes('shop=')) return '0.75';
    return '0.6';
  };
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (loc) => `  <url>
    <loc>${loc.replace(/&/g, '&amp;')}</loc>
    <lastmod>${crawledAt.slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${sitemapPriority(loc)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  // ── Write outputs ──
  const write = (name, data) => {
    const p = join(OUT_DIR, name);
    const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    writeFileSync(p, body, 'utf8');
    console.log(`   ✓ ${name}`);
  };

  write('sitemap.xml', sitemapXml);
  write('url-inventory.json', { crawledAt, count: urlInventory.length, urls: urlInventory });
  write('content-inventory.json', { crawledAt, ...contentInventory });
  write('media-inventory.json', {
    crawledAt,
    count: allMedia.length,
    byType: allMedia.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {}),
    items: allMedia,
  });
  write('assets-database.json', assetsDatabase);
  write('summary.json', assetsDatabase.meta);

  console.log(`\n✅ Done — ${urlInventory.length} URLs, ${allMedia.length} media assets`);
  console.log(`   Output: ${OUT_DIR}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
