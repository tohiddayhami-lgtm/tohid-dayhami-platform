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

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { col, doc: docId, orderField, dir, lim } = req.query;
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

      let url = `${BASE}/${col}?key=${API_KEY}&pageSize=${lim || 500}`;
      if (orderField) url += `&orderBy=${orderField}${dir === 'desc' ? ' desc' : ''}`;
      const r = await fetch(url);
      const data = await r.json();
      return res.json((data.documents || []).map(parseDoc));
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
