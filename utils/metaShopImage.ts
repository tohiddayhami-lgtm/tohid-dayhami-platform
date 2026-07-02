/** Hosts that often block hotlinking or are slow on mobile — serve via same-origin proxy. */
const PROXY_HOSTS = [
  'img.kwcdn.com',
  'kwcdn.com',
  'dkstatics-public.digikala.com',
  'digikala.com',
];

/** Normalize pasted / imported image URLs for storage and display. */
export const normalizeImageUrl = (raw: string | undefined): string => {
  let s = String(raw || '').trim().replace(/^["']+|["']+$/g, '');
  if (!s) return '';
  if (s.startsWith('//')) s = `https:${s}`;
  else if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  return s;
};

/** Resolve product image list from `images[]` or legacy single `image` field. */
export const resolveProductImages = (raw: { images?: unknown; image?: unknown } | null | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw.images) && raw.images.length) {
    return raw.images.map(i => normalizeImageUrl(String(i || ''))).filter(Boolean);
  }
  const single = normalizeImageUrl(String(raw.image || ''));
  return single ? [single] : [];
};

/** First image URL for a product (supports legacy `image` field). */
export const productMainImage = (raw: { images?: unknown; image?: unknown } | null | undefined): string =>
  resolveProductImages(raw)[0] || '';

export const needsMetaShopImageProxy = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXY_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

const clampWidth = (w: number) => Math.min(1200, Math.max(64, Math.round(w)));

/** Request a smaller file from CDNs that support URL transforms (Digikala OSS). */
export const applyImageWidthHint = (url: string, width: number): string => {
  const w = clampWidth(width);
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('digikala.com') || host.includes('dkstatics')) {
      u.searchParams.set(
        'x-oss-process',
        `image/resize,m_lfit,w_${w},h_${w}/format,webp/quality,q_85`,
      );
      return u.toString();
    }
  } catch { /* keep original */ }
  return url;
};

/** Card/detail thumbnail — proxied for hotlink-blocked CDNs, direct otherwise. */
export const metaShopProductImageUrl = (url: string | undefined, width = 400): string => {
  const s = normalizeImageUrl(url);
  if (!s || !/^https?:\/\//i.test(s)) return '';
  const sized = applyImageWidthHint(s, width);
  if (needsMetaShopImageProxy(sized)) {
    return `/api/ms-img?u=${encodeURIComponent(sized)}&w=${width}`;
  }
  return sized;
};

export const metaShopProductImageDirect = (url: string | undefined): string => {
  const s = normalizeImageUrl(url);
  return /^https?:\/\//i.test(s) ? s : '';
};
