/**
 * Server-side Firebase Storage upload proxy.
 * Iranian users often cannot finish client uploads to firebasestorage.googleapis.com
 * even when Firestore works via /api/fb. Vercel relays the file bytes instead.
 *
 * POST /api/storage-upload
 * Headers: X-File-Name, X-Folder (images|uploads|documents|temp), X-Content-Type
 * Body: raw file bytes
 */

const STORAGE_BUCKET = 'calculator-55611.firebasestorage.app';
const STORAGE_ROOT = 'tohid-dayhami-platform';

const FOLDERS = {
  uploads: `${STORAGE_ROOT}/uploads`,
  images: `${STORAGE_ROOT}/images`,
  documents: `${STORAGE_ROOT}/documents`,
  temp: `${STORAGE_ROOT}/temp`,
};

const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const DOCUMENT_MAX_BYTES = 120 * 1024 * 1024;
const PROXY_MAX_BYTES = 45 * 1024 * 1024; // Vercel request body limit (~4.5 MB on hobby; allow headroom)

function sanitizeFileName(name) {
  const cleaned = String(name || 'file')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 180) || 'file';
}

function publicMediaUrl(storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'binary');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-Folder, X-Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const fileName = req.headers['x-file-name'];
  const folder = String(req.headers['x-folder'] || 'uploads');
  const contentType = String(req.headers['x-content-type'] || 'application/octet-stream');

  if (!fileName) return res.status(400).json({ error: 'x_file_name_required' });

  const folderPath = FOLDERS[folder];
  if (!folderPath) return res.status(400).json({ error: 'invalid_folder' });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'body_read_failed', detail: String(e) });
  }

  if (!body?.length) return res.status(400).json({ error: 'empty_body' });

  const maxBytes = folder === 'documents' ? DOCUMENT_MAX_BYTES : IMAGE_MAX_BYTES;
  if (body.length > PROXY_MAX_BYTES) {
    return res.status(413).json({
      error: 'proxy_body_too_large',
      detail: `Max ${Math.round(PROXY_MAX_BYTES / (1024 * 1024))}MB via server proxy. Use a smaller file or compress the image.`,
    });
  }
  if (body.length > maxBytes) {
    return res.status(413).json({ error: 'file_too_large' });
  }

  if (folder === 'images' && !contentType.startsWith('image/')) {
    return res.status(400).json({ error: 'images_must_be_image_type' });
  }

  const storagePath = `${folderPath}/${Date.now()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(storagePath)}`;

  try {
    const upstream = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });

    let result = {};
    try {
      result = await upstream.json();
    } catch {
      result = {};
    }

    if (!upstream.ok) {
      const detail = result?.error?.message || `HTTP ${upstream.status}`;
      return res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502).json({
        error: 'storage_upload_failed',
        detail,
        path: storagePath,
      });
    }

    return res.json({
      ok: true,
      url: publicMediaUrl(storagePath),
      path: storagePath,
    });
  } catch (e) {
    return res.status(502).json({ error: 'storage_proxy_failed', detail: String(e) });
  }
}
