import type { MetaShop } from '../types';

const PREFIX = 'ms_shell_';
const BOOT_PREFIX = 'ms_boot_';
const TTL_MS = 6 * 60 * 60 * 1000;
const BOOT_TTL_MS = 5 * 60 * 1000;

function readCachedEntry(raw: string | null, ttlMs: number): MetaShop | null {
  if (!raw) return null;
  try {
    const { shop, ts } = JSON.parse(raw) as { shop: MetaShop; ts: number };
    if (!shop?.id || Date.now() - ts > ttlMs) return null;
    return { ...shop, products: [] };
  } catch {
    return null;
  }
}

/** Cached shop metadata for instant reopen — products are always re-fetched. */
export function readMetaShopShellCache(slug: string): MetaShop | null {
  try {
    const fromBoot = readCachedEntry(sessionStorage.getItem(BOOT_PREFIX + slug), BOOT_TTL_MS);
    if (fromBoot) return fromBoot;
    return readCachedEntry(localStorage.getItem(PREFIX + slug), TTL_MS);
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
