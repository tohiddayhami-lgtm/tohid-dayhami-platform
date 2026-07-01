/** Hosts that often block hotlinking or are slow on mobile — serve via same-origin proxy. */
const PROXY_HOSTS = ['img.kwcdn.com', 'kwcdn.com'];

export const needsMetaShopImageProxy = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXY_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

/** Card/detail thumbnail — proxied for Temu CDN, direct otherwise. */
export const metaShopProductImageUrl = (url: string | undefined, width = 480): string => {
  const s = String(url || '').trim();
  if (!s || !/^https?:\/\//i.test(s)) return '';
  if (needsMetaShopImageProxy(s)) {
    return `/api/ms-img?u=${encodeURIComponent(s)}&w=${width}`;
  }
  return s;
};

export const metaShopProductImageDirect = (url: string | undefined): string => {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
};
