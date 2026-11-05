/**
 * Cartable API: website signups + read existing requests.
 *
 * GET  /api/cartable              → docs (no key)
 * GET  /api/cartable + X-Api-Key  → all tickets (requests)
 * GET  /api/cartable?resource=customers + key → all customers
 * GET  /api/cartable?id=TICKET_ID + key → one ticket
 * POST /api/cartable + key        → register customer
 */

import crypto from 'crypto';

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) && Math.abs(v) < 2e15
      ? { integerValue: String(v) }
      : { doubleValue: v };
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
    throw new Error(`firestore write ${col}/${id}: ${r.status} ${t.slice(0, 300)}`);
  }
}

async function listCollection(col, pageSize, pageToken) {
  const qs = new URLSearchParams({
    pageSize: String(Math.min(Math.max(Number(pageSize) || 200, 1), 300)),
    key: API_KEY,
  });
  if (pageToken) qs.set('pageToken', pageToken);
  const r = await fetch(`${BASE}/${col}?${qs}`);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`firestore list ${col}: ${r.status} ${t.slice(0, 200)}`);
  }
  const data = await r.json();
  return {
    items: (data.documents || []).map(parseDoc),
    nextPageToken: data.nextPageToken || '',
  };
}

async function listAll(col, maxItems) {
  const out = [];
  let pageToken = '';
  const cap = Math.min(Math.max(Number(maxItems) || 2500, 1), 4000);
  do {
    const page = await listCollection(col, 300, pageToken);
    out.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken && out.length < cap);
  return { items: out.slice(0, cap), nextPageToken: out.length >= cap ? pageToken : '' };
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

function originFromReq(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.tohiddayhami.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function keysEqual(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (!x.length || x.length !== y.length) return false;
  try { return crypto.timingSafeEqual(x, y); } catch { return false; }
}

function readKey(req, body) {
  const header = req.headers['x-api-key'] || req.headers['x-cartable-key'] || '';
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return String(header || bearer || body?.apiKey || body?.key || '').trim();
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function digits(s) {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return String(s || '')
    .replace(/[۰-۹]/g, ch => String(fa.indexOf(ch)))
    .replace(/[٠-٩]/g, ch => String(ar.indexOf(ch)))
    .replace(/\D/g, '');
}

function flattenExtra(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return {};
  const out = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v == null || v === '') continue;
    const key = String(k).replace(/[.[\]*$]/g, '_').slice(0, 80);
    if (!key) continue;
    out[key] = typeof v === 'object' ? JSON.stringify(v).slice(0, 4000) : String(v).slice(0, 4000);
  }
  return out;
}

function publicTicket(t) {
  const cd = { ...(t.customData || {}) };
  delete cd.__assigneePersonnelId;
  delete cd.__assigneeRole;
  delete cd.whatsappNotified;
  return {
    id: t.id,
    createdAt: t.createdAt || '',
    status: t.status || '',
    name: t.customerName || '',
    company: t.companyName || '',
    phone: t.phoneNumber || '',
    whatsapp: t.whatsappNumber || t.phoneNumber || '',
    city: t.location || '',
    serviceId: t.serviceId || '',
    title: cd.formTitle || '',
    description: t.description || '',
    data: cd,
  };
}

function publicCustomer(c) {
  return {
    id: c.id,
    name: c.fullName || '',
    company: c.companyName || '',
    phone: c.phoneNumber || '',
    whatsapp: c.whatsappNumber || c.phoneNumber || '',
    email: c.email || '',
    city: c.location || '',
    source: c.source || '',
    firstContact: c.firstContact || '',
    totalTickets: Number(c.totalTickets || 0),
  };
}

function sortByDateDesc(items, field) {
  return items.sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
}

function docs(origin) {
  return {
    name: 'Cartable API',
    endpoint: `${origin}/api/cartable`,
    auth: {
      header: 'X-Api-Key: <cartableApiKey>',
      alt: 'Authorization: Bearer <cartableApiKey>',
    },
    list: {
      method: 'GET',
      url: `${origin}/api/cartable`,
      description: 'همه درخواست‌های ثبت‌شده کارتابل',
      customers: `${origin}/api/cartable?resource=customers`,
      one: `${origin}/api/cartable?id=TICKET_ID`,
    },
    create: {
      method: 'POST',
      required: ['name', 'phone'],
      body: {
        name: 'string — نام و نام خانوادگی',
        phone: 'string — موبایل',
        email: 'string — اختیاری',
        company: 'string — اختیاری',
        city: 'string — اختیاری',
        whatsapp: 'string — اختیاری، پیش‌فرض همان phone',
        note: 'string — توضیحات ثبت‌نام',
        source: 'string — منبع، پیش‌فرض Website',
        serviceId: 'string — اختیاری',
        createTicket: 'boolean — اگر true در کارتابل هم درخواست ساخته می‌شود (پیش‌فرض true)',
        extra: 'object — فیلدهای اضافه',
      },
      example: {
        name: 'Ali Mohammadi',
        phone: '09121234567',
        email: 'ali@example.com',
        company: 'Pars Trading',
        city: 'تهران',
        source: 'Website signup',
        note: 'ثبت‌نام از وب‌سایت',
      },
    },
    note: 'کلید را در فرانت‌اند عمومی نگذارید. از سرور وب‌سایت صدا بزنید.',
  };
}

async function requireApiKey(req, body) {
  const cfg = await getDoc('settings', 'appConfig');
  const expected = String(process.env.CARTABLE_API_KEY || cfg?.cartableApiKey || '').trim();
  if (!expected) {
    return { error: 403, json: { error: 'api_key_not_configured', message: 'در کارتابل یک کلید API بسازید.' } };
  }
  if (!keysEqual(readKey(req, body || {}), expected)) {
    return { error: 401, json: { error: 'unauthorized' } };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key, X-Cartable-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const origin = originFromReq(req);

  try {
    if (req.method === 'GET') {
      const sentKey = readKey(req, { apiKey: req.query?.apiKey, key: req.query?.key });
      if (!sentKey) return res.status(200).json(docs(origin));
      const gate = await requireApiKey(req, { apiKey: req.query?.apiKey, key: req.query?.key });
      if (!gate.ok) return res.status(gate.error).json(gate.json);

      const oneId = String(req.query?.id || '').trim();
      if (oneId) {
        const ticket = await getDoc('tickets', oneId);
        if (!ticket) return res.status(404).json({ error: 'not_found' });
        return res.status(200).json({ ok: true, request: publicTicket(ticket) });
      }

      const resource = String(req.query?.resource || 'tickets').toLowerCase();
      if (resource === 'customers') {
        const listed = await listAll('customers');
        const customers = sortByDateDesc(listed.items.map(publicCustomer), 'firstContact');
        return res.status(200).json({
          ok: true,
          count: customers.length,
          customers,
          nextPageToken: listed.nextPageToken || undefined,
        });
      }

      const listed = await listAll('tickets');
      const requests = sortByDateDesc(listed.items.map(publicTicket), 'createdAt');
      return res.status(200).json({
        ok: true,
        count: requests.length,
        requests,
        nextPageToken: listed.nextPageToken || undefined,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const gate = await requireApiKey(req, body);
    if (!gate.ok) return res.status(gate.error).json(gate.json);

    const src = body.customer && typeof body.customer === 'object' ? { ...body, ...body.customer } : body;
    const name = pick(src, ['name', 'fullName', 'full_name', 'customerName', 'نام', 'نام و نام خانوادگی']);
    const phone = pick(src, ['phone', 'mobile', 'phoneNumber', 'tel', 'موبایل', 'تلفن']);
    const email = pick(src, ['email', 'ایمیل']);
    const company = pick(src, ['company', 'companyName', 'brand', 'شرکت']);
    const city = pick(src, ['city', 'location', 'شهر']) || '-';
    const whatsapp = pick(src, ['whatsapp', 'whatsappNumber', 'واتس‌اپ']) || phone;
    const note = pick(src, ['note', 'description', 'message', 'توضیح', 'توضیحات']);
    const source = pick(src, ['source', 'منبع']) || 'Website';
    const serviceId = pick(src, ['serviceId', 'service']) || 'website';
    const createTicket = src.createTicket !== false && src.createTicket !== 'false';
    const extra = flattenExtra(src.extra && typeof src.extra === 'object' ? src.extra : {});

    const phoneNorm = digits(phone);
    if (!name) return res.status(400).json({ error: 'name_required' });
    if (phoneNorm.length < 8 || phoneNorm.length > 15) {
      return res.status(400).json({ error: 'phone_required' });
    }

    const now = new Date().toISOString();
    let existing = await queryByField('customers', 'phoneNumber', phone);
    if (!existing && phone !== phoneNorm) {
      existing = await queryByField('customers', 'phoneNumber', phoneNorm);
    }

    let customerId;
    let created = false;
    if (existing) {
      customerId = existing.id;
      await setDoc('customers', existing.id, {
        ...existing,
        fullName: name || existing.fullName,
        companyName: company || existing.companyName,
        location: city !== '-' ? city : (existing.location || '-'),
        whatsappNumber: whatsapp || existing.whatsappNumber,
        email: email || existing.email,
        totalTickets: Number(existing.totalTickets || 0) + (createTicket ? 1 : 0),
        source: existing.source || source,
      });
    } else {
      created = true;
      customerId = `C-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const suffix = phoneNorm.slice(-4) || '0000';
      await setDoc('customers', customerId, {
        id: customerId,
        fullName: name,
        companyName: company || undefined,
        location: city,
        phoneNumber: phone,
        whatsappNumber: whatsapp,
        email: email || undefined,
        firstContact: now,
        totalTickets: createTicket ? 1 : 0,
        source,
        loyaltyCode: `VIP-${suffix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      });
    }

    let ticketId = null;
    if (createTicket) {
      ticketId = `WEB-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const desc = [
        `موضوع: ثبت‌نام وب‌سایت`,
        `منبع: ${source}`,
        `شناسه مشتری: ${customerId}`,
        `نام: ${name}`,
        `موبایل: ${phone}`,
        email ? `ایمیل: ${email}` : '',
        company ? `شرکت: ${company}` : '',
        city && city !== '-' ? `شهر: ${city}` : '',
        note ? `توضیح: ${note}` : '',
        ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
      ].filter(Boolean).join('\n');

      await setDoc('tickets', ticketId, {
        id: ticketId,
        customerName: name,
        companyName: company || undefined,
        location: city,
        phoneNumber: phone,
        whatsappNumber: whatsapp,
        serviceId,
        description: desc,
        status: 'ثبت شده',
        createdAt: now,
        timeline: [{
          type: 'creation',
          title: 'ثبت‌نام از وب‌سایت',
          description: `${name} از ${source}`,
          actorName: 'سیستم',
          timestamp: now,
          visibility: 'public',
        }],
        customData: {
          formTitle: source,
          importSource: 'website_api',
          customerId,
          customerName: name,
          customerPhone: phone,
          ...(email ? { ایمیل: email } : {}),
          ...(note ? { توضیح: note } : {}),
          ...extra,
        },
      });
    }

    return res.status(created ? 201 : 200).json({
      ok: true,
      customerId,
      ticketId,
      created,
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) });
  }
}
