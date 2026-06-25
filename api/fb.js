/**
 * Vercel serverless proxy for Firestore REST API.
 * Iranian users can't reach firestore.googleapis.com directly (Google blocks Iran).
 * This function runs on Vercel's servers (outside Iran) and relays Firestore requests.
 *
 * Endpoints:
 *   GET  /api/fb?col=<collection>                    → list documents
 *   GET  /api/fb?col=<collection>&doc=<id>           → get single document
 *   POST /api/fb?col=<collection>&doc=<id>           → set (create/overwrite) document
 *   DELETE /api/fb?col=<collection>&doc=<id>         → delete document
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY    = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Firestore REST → plain JS ──────────────────────────────────────────────

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  return { id, ...parseFields(doc.fields || {}) };
}

function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = parseValue(v);
  }
  return obj;
}

function parseValue(v) {
  if ('stringValue'    in v) return v.stringValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return v.doubleValue;
  if ('booleanValue'   in v) return v.booleanValue;
  if ('nullValue'      in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('bytesValue'     in v) return v.bytesValue;
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue'       in v) return parseFields(v.mapValue.fields || {});
  return null;
}

// ── plain JS → Firestore REST ──────────────────────────────────────────────

function toFirestoreDoc(data) {
  const { id, ...rest } = data;
  return { fields: toFields(rest) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toValue(v);
  }
  return fields;
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return Number.isInteger(v) && Math.abs(v) < 2e15
    ? { integerValue: String(v) }
    : { doubleValue: v };
  if (typeof v === 'string')  return { stringValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.filter(x => x !== undefined).map(toValue) } };
  if (typeof v === 'object')  return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
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

async function queryAllByField(col, field, value) {
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
        orderBy: [{ field: { fieldPath: 'chunkIndex' } }],
      },
    }),
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return (rows || [])
    .map(row => row.document)
    .filter(Boolean)
    .map(parseDoc);
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { col, doc: docId, orderField, dir, lim, slug, whereField, whereEq, all } = req.query;
  if (!col) return res.status(400).json({ error: 'col required' });

  try {
    // ── GET ──────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (docId) {
        const r = await fetch(`${BASE}/${col}/${docId}?key=${API_KEY}`);
        if (r.status === 404) return res.json(null);
        if (!r.ok) return res.status(r.status).json(null);
        const d = await r.json();
        return res.json(d.fields ? parseDoc(d) : null);
      }

      // Single-doc lookup by field (e.g. metaShops?slug=shiraz-sweets-nuts) — avoids downloading the whole collection.
      const field = slug ? 'slug' : whereField;
      const value = slug || whereEq;
      if (field && value) {
        if (all === '1' || all === 'true') {
          return res.json(await queryAllByField(col, String(field), String(value)));
        }
        const one = await queryByField(col, String(field), String(value));
        return res.json(one);
      }

      // Firestore caps pageSize at 300, so we MUST follow nextPageToken to return the
      // whole collection — otherwise large collections (e.g. tickets) get silently
      // truncated to the first page and look "deleted" in the app.
      const pageSize = Math.min(Number(lim) || 300, 300);
      let listUrl = `${BASE}/${col}?key=${API_KEY}&pageSize=${pageSize}`;
      if (orderField) listUrl += `&orderBy=${orderField}${dir === 'desc' ? ' desc' : ''}`;
      let all = [];
      let pageToken = null;
      let pages = 0;
      const MAX_PAGES = 50; // safety cap (~15000 docs)
      do {
        const pageUrl = pageToken ? `${listUrl}&pageToken=${encodeURIComponent(pageToken)}` : listUrl;
        const r = await fetch(pageUrl);
        if (!r.ok) break;
        const data = await r.json();
        if (Array.isArray(data.documents)) all = all.concat(data.documents);
        pageToken = data.nextPageToken || null;
        pages++;
      } while (pageToken && pages < MAX_PAGES);
      return res.json(all.map(parseDoc));
    }

    // ── POST (setDoc) ─────────────────────────────────────────────────────
    if (req.method === 'POST') {
      if (!docId) return res.status(400).json({ error: 'doc required' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const fsDoc = toFirestoreDoc(body);
      const r = await fetch(`${BASE}/${col}/${docId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fsDoc),
      });
      const result = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: result });
      return res.json({ ok: true });
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!docId) return res.status(400).json({ error: 'doc required' });
      const r = await fetch(`${BASE}/${col}/${docId}?key=${API_KEY}`, { method: 'DELETE' });
      if (!r.ok) return res.status(r.status).json({ error: 'delete failed' });
      return res.json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
