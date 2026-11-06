import JSZip from 'jszip';

const SKIP = /(^|\/)(__macosx\/|\.ds_store$|thumbs\.db$|desktop\.ini$|\.git\/)/i;
const MAX_FILES = 800;

export function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
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
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml',
    wasm: 'application/wasm',
    map: 'application/json',
    webmanifest: 'application/manifest+json',
    avif: 'image/avif',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
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

function stripCommonRoot(paths: string[]): { root: string; paths: string[] } {
  if (paths.length < 2) return { root: '', paths };
  const first = paths[0].split('/')[0];
  if (!first || first.includes('.')) return { root: '', paths };
  if (!paths.every(p => p === first || p.startsWith(`${first}/`))) return { root: '', paths };
  return {
    root: first,
    paths: paths.map(p => (p.startsWith(`${first}/`) ? p.slice(first.length + 1) : '')),
  };
}

export function pickPackEntry(paths: string[]): string {
  const html = paths.filter(p => /\.(html?|HTML?)$/.test(p));
  const rank = (p: string) => {
    const n = p.replace(/\\/g, '/').toLowerCase();
    if (n === 'index.html' || n === 'index.htm') return 0;
    if (n === 'magazine/index.html' || n.endsWith('/magazine/index.html')) return 1;
    if (n.includes('/magazine/') && n.endsWith('/index.html')) return 2;
    if (n.endsWith('/index.html') || n.endsWith('/index.htm')) return 3 + n.split('/').length;
    return 20 + n.split('/').length;
  };
  html.sort((a, b) => rank(a) - rank(b) || a.length - b.length);
  if (html[0]) return html[0];
  const pdf = paths.find(p => /\.pdf$/i.test(p));
  return pdf || paths[0] || 'index.html';
}

export async function listHostedPackZip(file: File): Promise<{ paths: string[]; entry: string; root: string }> {
  const zip = await JSZip.loadAsync(file);
  const rawList = Object.values(zip.files)
    .filter(entry => !entry.dir)
    .map(entry => normalizeZipPath(entry.name))
    .filter(name => name && !SKIP.test(name));
  if (!rawList.length) throw new Error('empty_zip');
  const { root, paths: stripped } = stripCommonRoot(rawList);
  const paths = stripped.filter(Boolean);
  if (paths.length > MAX_FILES) throw new Error('too_many_files');
  const hasRunnable = paths.some(p => /\.(html?|pdf)$/i.test(p));
  if (!hasRunnable) throw new Error('no_html');
  return { paths, entry: pickPackEntry(paths), root };
}
