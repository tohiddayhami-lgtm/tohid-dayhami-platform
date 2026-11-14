/**
 * Public order intake for an uploaded Meta Shop storefront (HTML or ZIP).
 * POST /api/meta-shop-order?shop=<slug>
 * Body: { shopSlug?, data?, customerName?, phone?, items?, ... }
 * Writes metaShopOrders and returns { ok, tracking_code }.
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

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
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  return null;
}

function parseDoc(doc) {
  const id = String(doc.name || '').split('/').pop();
  return { id, ...parseFields(doc.fields || {}) };
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) && Math.abs(v) < 2e15 ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter(x => x !== undefined).map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) fields[k] = toValue(v);
  }
  return fields;
}

async function getDoc(col, id) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields ? parseDoc(d) : null;
}

async function setDoc(col, id, data) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields({ ...data, id }) }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`firestore write ${col}/${id}: ${r.status} ${t.slice(0, 240)}`);
  }
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

function flattenBody(payload) {
  let inner = payload.data;
  if (typeof inner === 'string') {
    try { inner = JSON.parse(inner); } catch { inner = {}; }
  }
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) inner = {};
  const out = { ...inner };
  for (const [k, v] of Object.entries(payload || {})) {
    if (['files', 'data'].includes(k) || v === undefined) continue;
    if (out[k] === undefined) out[k] = v;
  }
  return out;
}

function pick(data, keys) {
  const entries = Object.entries(data || {});
  for (const key of keys) {
    if (data[key] != null && String(data[key]).trim()) return String(data[key]).trim();
  }
  const wanted = keys.map(k => k.toLowerCase());
  for (const [k, v] of entries) {
    const kl = k.toLowerCase();
    if (wanted.some(w => kl === w || kl.includes(w))) {
      const s = v == null ? '' : String(v).trim();
      if (s && s !== '{}' && s !== '[]') return s;
    }
  }
  return '';
}

function moneyNumber(s) {
  const n = String(s || '').replace(/[^\d.]/g, '');
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseItems(raw, currency) {
  if (Array.isArray(raw)) {
    return raw.map((it, i) => ({
      productId: String(it?.productId || it?.sku || it?.id || `line-${i + 1}`).slice(0, 80),
      name: String(it?.name || it?.title || it?.sku || `قلم ${i + 1}`).slice(0, 240),
      sku: it?.sku ? String(it.sku).slice(0, 80) : undefined,
      unit: it?.unit ? String(it.unit).slice(0, 40) : undefined,
      qty: Math.max(1, Number(it?.qty) || 1),
      unitPrice: it?.unitPrice != null ? Number(it.unitPrice) || 0 : undefined,
      lineTotal: it?.lineTotal != null ? Number(it.lineTotal) || 0 : undefined,
      currency: it?.currency || currency,
    })).slice(0, 80);
  }
  const lines = String(raw || '').split(/\n/).map(s => s.trim()).filter(Boolean);
  return lines.slice(0, 80).map((line, i) => {
    const qtyM = line.match(/[×x]\s*(\d+)/i);
    const skuM = line.split('·')[0];
    return {
      productId: String(skuM || `line-${i + 1}`).trim().slice(0, 80) || `line-${i + 1}`,
      name: line.slice(0, 240),
      qty: qtyM ? Math.max(1, Number(qtyM[1]) || 1) : 1,
      currency,
    };
  });
}

function trackingFrom(data, phone) {
  const given = pick(data, ['کد پیگیری', 'trackingCode', 'tracking', 'ref', 'کد رهگیری']);
  const clean = given.replace(/\s+/g, '').slice(0, 40);
  if (clean && clean.length >= 4) return clean.toUpperCase();
  const tail = String(phone || '').replace(/\D/g, '').slice(-4) || '0000';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SHP-${tail}-${rand}`;
}

function shopSlugFrom(data, queryShop) {
  const q = String(queryShop || '').trim();
  if (q) return q;
  const direct = pick(data, ['shopSlug', 'slug', 'shopId']);
  if (direct && !/[\s()]/.test(direct)) return direct;
  const label = pick(data, ['فروشگاه', 'shop']);
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const data = flattenBody(payload);
    if (data.honeypot || data.hp || payload.honeypot) {
      return res.status(200).json({ ok: true, tracking_code: 'OK' });
    }

    const slug = shopSlugFrom(data, req.query.shop || payload.shop || payload.shopSlug);
    if (!slug) return res.status(400).json({ ok: false, error: 'shop_required' });

    let shop = await getDoc('metaShops', slug);
    if (!shop || shop.slug !== slug) shop = await queryByField('metaShops', 'slug', slug);
    if (!shop || shop.isActive === false) return res.status(404).json({ ok: false, error: 'shop_not_found' });

    const name = pick(data, ['customerName', 'نام خریدار', 'نام', 'name', 'fullName']) || 'بدون نام';
    const phone = pick(data, ['phone', 'موبایل / واتس‌اپ', 'موبایل', 'mobile', 'whatsapp', 'tel']);
    if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ ok: false, error: 'phone_required' });

    const company = pick(data, ['company', 'نام شرکت', 'شرکت']);
    const email = pick(data, ['email', 'ایمیل']);
    const country = pick(data, ['country', 'کشور']);
    const city = pick(data, ['city', 'شهر / بندر مقصد', 'شهر']);
    const currency = pick(data, ['currency', 'ارز نمایش']) || shop.currency || 'USD';
    const itemsRaw = data.items || data['اقلام درخواستی'] || '';
    const items = parseItems(itemsRaw, currency);
    const total = moneyNumber(pick(data, ['total', 'جمع تخمینی (قیمت پایه)', 'جمع کل', 'جمع']));
    const noteBits = ['نوع خریدار', 'اینکوترمز', 'زمان مورد نیاز', 'خدمات تکمیلی', 'توضیحات', 'notes', 'message']
      .map(k => (data[k] ? `${k}: ${String(data[k]).slice(0, 500)}` : ''))
      .filter(Boolean);
    const trackingCode = trackingFrom(data, phone);
    const now = new Date().toISOString();
    const orderId = `mso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const order = {
      id: orderId,
      shopId: shop.id,
      shopName: shop.name || slug,
      shopType: shop.type || 'products',
      trackingCode,
      customerName: name.slice(0, 120),
      company: company ? company.slice(0, 160) : undefined,
      phone: phone.slice(0, 40),
      email: email ? email.slice(0, 120) : undefined,
      country: country ? country.slice(0, 80) : undefined,
      city: city ? city.slice(0, 80) : undefined,
      notes: noteBits.join('\n').slice(0, 4000) || undefined,
      items,
      itemsTotal: total,
      total,
      currency: String(currency).slice(0, 12),
      status: 'new',
      createdAt: now,
      via: 'shop',
    };

    await setDoc('metaShopOrders', orderId, order);
    return res.status(200).json({ ok: true, tracking_code: trackingCode, ticketId: orderId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
