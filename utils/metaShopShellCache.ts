import type { MetaShop } from '../types';

const PREFIX = 'ms_shell_';
const TTL_MS = 6 * 60 * 60 * 1000;

/** Cached shop metadata for instant reopen — products are always re-fetched. */
export function readMetaShopShellCache(slug: string): MetaShop | null {
  try {
    const raw = localStorage.getItem(PREFIX + slug);
    if (!raw) return null;
    const { shop, ts } = JSON.parse(raw) as { shop: MetaShop; ts: number };
    if (!shop?.id || Date.now() - ts > TTL_MS) return null;
    return { ...shop, products: [] };
  } catch {
    return null;
  }
}

export function writeMetaShopShellCache(slug: string, shop: MetaShop) {
  try {
    const { products: _drop, ...shell } = shop;
    localStorage.setItem(PREFIX + slug, JSON.stringify({
      shop: { ...shell, products: [] },
      ts: Date.now(),
    }));
  } catch { /* quota */ }
}
