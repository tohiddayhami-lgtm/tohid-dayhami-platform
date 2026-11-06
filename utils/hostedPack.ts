import JSZip from 'jszip';

const SKIP = /(^|\/)(__macosx\/|\.ds_store$|thumbs\.db$|desktop\.ini$|\.git\/)/i;
const MAX_FILES = 400;
const MAX_UNZIPPED = 90 * 1024 * 1024;

export type HostedPackFile = { path: string; blob: Blob; mime: string };

export function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'text/html;charset=utf-8',
    htm: 'text/html;charset=utf-8',
    css: 'text/css',
    js: 'text/javascript',
    mjs: 'text/javascript',
    json: 'application/json',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    mp4: 'video/mp4',
    webm: 'video/webm',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    mp3: 'audio/mpeg',
    txt: 'text/plain;charset=utf-8',
    xml: 'application/xml',
  };
  return map[ext] || 'application/octet-stream';
}

function normalizeZipPath(raw: string): string {
  return String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function stripCommonRoot(paths: string[]): string[] {
  if (paths.length < 2) return paths;
  const first = paths[0].split('/')[0];
  if (!first || first.includes('.')) return paths;
  if (!paths.every(p => p === first || p.startsWith(`${first}/`))) return paths;
  return paths.map(p => (p.startsWith(`${first}/`) ? p.slice(first.length + 1) : ''));
}

export function pickPackEntry(paths: string[]): string {
  const html = paths.filter(p => /\.(html?|HTML?)$/.test(p));
  const rank = (p: string) => {
    const n = p.replace(/\\/g, '/').toLowerCase();
    if (n === 'go/index.html' || n.endsWith('/go/index.html')) return 0;
    if (n === 'index.html') return 1;
    if (n.endsWith('/index.html') && n.split('/').length === 2 && n.includes('magazine')) return 2;
    if (n === 'magazine/index.html') return 2;
    if (n.endsWith('/index.html')) return 3;
    return 4;
  };
  html.sort((a, b) => rank(a) - rank(b) || a.length - b.length);
  return html[0] || paths[0] || 'index.html';
}

export async function readHostedPackZip(file: File): Promise<{ files: HostedPackFile[]; entry: string }> {
  const zip = await JSZip.loadAsync(file);
  const rawList = Object.values(zip.files)
    .filter(entry => !entry.dir)
    .map(entry => ({ entry, raw: normalizeZipPath(entry.name) }))
    .filter(item => item.raw && !SKIP.test(item.raw));
  if (!rawList.length) throw new Error('empty_zip');

  const stripped = stripCommonRoot(rawList.map(item => item.raw));
  const files: HostedPackFile[] = [];
  let unzipped = 0;
  for (let i = 0; i < rawList.length; i++) {
    const path = stripped[i];
    if (!path) continue;
    const buf = await rawList[i].entry.async('uint8array');
    unzipped += buf.byteLength;
    if (unzipped > MAX_UNZIPPED) throw new Error('zip_too_large');
    if (files.length >= MAX_FILES) throw new Error('too_many_files');
    const mime = mimeForPath(path);
    files.push({ path, blob: new Blob([new Uint8Array(buf)], { type: mime }), mime });
  }
  if (!files.some(f => /\.html?$/i.test(f.path))) throw new Error('no_html');
  return { files, entry: pickPackEntry(files.map(f => f.path)) };
}
