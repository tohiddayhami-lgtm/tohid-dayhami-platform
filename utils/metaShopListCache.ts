import type { MetaBazaar, MetaShop } from '../types';
import { stripProductsForList } from './metaShopChunks';

const SHOPS_KEY = 'ms_list_cache_v1';
const BAZAARS_KEY = 'ms_bazaars_cache_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

type CacheEnvelope<T> = { items: T[]; ts: number };

function readEnvelope<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { items, ts } = JSON.parse(raw) as CacheEnvelope<T>;
    if (!Array.isArray(items) || Date.now() - ts > TTL_MS) return null;
    return items;
  } catch {
    return null;
  }
}

function writeEnvelope<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ items, ts: Date.now() }));
  } catch { /* quota */ }
}

/** Cached shop shells for instant export-shop / directory lists. */
export function readMetaShopListCache(): MetaShop[] | null {
  return readEnvelope<MetaShop>(SHOPS_KEY);
}

export function writeMetaShopListCache(shops: MetaShop[]) {
  writeEnvelope(SHOPS_KEY, shops.map(stripProductsForList));
}

export function readMetaBazaarListCache(): MetaBazaar[] | null {
  return readEnvelope<MetaBazaar>(BAZAARS_KEY);
}

export function writeMetaBazaarListCache(bazaars: MetaBazaar[]) {
  writeEnvelope(BAZAARS_KEY, bazaars);
}
