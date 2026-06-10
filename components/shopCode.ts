import { MetaShop } from '../types';

// Unambiguous charset (no 0/O/1/I) for clean, professional 4-char shop codes.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const randomShopCode = (): string => {
  let s = '';
  for (let i = 0; i < 4; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
};

// Stable code derived from a seed (slug/id) — used as a fallback for shops that
// don't yet have a persisted `code`, so every shop still shows a consistent code.
export const deterministicCode = (seed: string): string => {
  let h = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  h = Math.abs(h) || 1;
  let s = '';
  for (let i = 0; i < 4; i++) { s += CHARS[h % CHARS.length]; h = Math.floor(h / CHARS.length) + (i + 1) * 31 + 7; }
  return s;
};

// The code shown for a shop (persisted code wins; else a stable fallback).
export const shopCodeOf = (shop: Pick<MetaShop, 'code' | 'slug' | 'id'>): string =>
  (shop.code && shop.code.trim().toUpperCase()) || deterministicCode(shop.slug || shop.id);

// A fresh unique code not colliding with existing shops' codes.
export const uniqueShopCode = (existing: MetaShop[]): string => {
  const used = new Set(existing.map(s => (s.code || '').trim().toUpperCase()).filter(Boolean));
  let c = randomShopCode();
  let guard = 0;
  while (used.has(c) && guard++ < 200) c = randomShopCode();
  return c;
};
