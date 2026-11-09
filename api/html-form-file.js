/**
 * Public HTML-form photo/file upload → Firebase Storage (calculator-55611).
 * POST { formId, filename, contentType, data }  data = base64
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BUCKET = 'calculator-55611.firebasestorage.app';
const MAX_BYTES = 8 * 1024 * 1024;

export const config = { api: { bodyParser: { sizeLimit: '9mb' } } };

function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = parseValue(v);
  return obj;
}

function parseValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  return null;
}

async function getForm(id) {
  const r = await fetch(`${BASE}/custom_forms/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields ? { id, ...parseFields(d.fields) } : null;
}

function safeName(name) {
  const cleaned = String(name || 'file')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  return cleaned || 'file';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const formId = String(body.formId || '').trim();
    const filename = safeName(body.filename);
    const contentType = String(body.contentType || 'application/octet-stream').slice(0, 80);
    const data = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!formId || !data) return res.status(400).json({ error: 'formId_and_data_required' });

    const form = await getForm(formId);
    if (!form || (form.kind !== 'html' && form.kind !== 'pack') || form.isPublic === false) {
      return res.status(404).json({ error: 'form_not_found' });
    }
    if (form.isClosed) return res.status(403).json({ error: 'form_closed' });

    const buf = Buffer.from(data, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'empty_file' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'file_too_large' });

    const folder = contentType.startsWith('image/') ? 'images' : 'uploads';
    const path = `tohid-dayhami-platform/${folder}/${Date.now()}-${filename}`;
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType || 'application/octet-stream' },
      body: buf,
    });
    const json = await up.json().catch(() => ({}));
    if (!up.ok) {
      return res.status(502).json({ error: 'storage_upload_failed', detail: json.error || up.status });
    }
    const token = json.downloadTokens || '';
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    return res.status(200).json({ ok: true, url, name: filename, type: contentType, size: buf.length });
  } catch (err) {
    return res.status(500).json({ error: 'upload_failed', detail: String(err?.message || err).slice(0, 200) });
  }
}
