import { MetaShop, MetaShopProduct } from '../types';

/** Parse comma / Persian-comma / semicolon / newline separated keywords. */
export function parseSearchKeywords(raw?: string | string[]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  return String(raw)
    .split(/[,،;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function formatSearchKeywordsForInput(keywords?: string[]): string {
  return (keywords || []).join('، ');
}

export function keywordsHaystack(keywords?: string[]): string {
  return (keywords || []).join(' ');
}

const I18N_FLAT = (i18n?: Record<string, Record<string, string>>): string[] => {
  if (!i18n) return [];
  return Object.values(i18n).flatMap(lang => Object.values(lang || {}));
};

/** Normalize text for fuzzy search — Persian variants, case, ZWNJ, diacritics. */
export function normalizeSearchText(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\u200c\u200d\uFEFF]/g, ' ')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a user query into searchable tokens (words / keyword phrases). */
export function searchQueryTokens(query: string): string[] {
  const raw = normalizeSearchText(query);
  if (!raw) return [];
  return raw
    .split(/[\s,،;|/\\+]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Flexible text search:
 * - full phrase substring match (legacy behaviour), or
 * - every query token must appear somewhere in haystack (order-independent, gaps allowed).
 */
export function textMatchesSearchQuery(haystack: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const hay = normalizeSearchText(haystack);
  const phrase = normalizeSearchText(q);
  if (!phrase) return true;
  if (hay.includes(phrase)) return true;
  const tokens = searchQueryTokens(q);
  if (tokens.length === 0) return true;
  if (tokens.length === 1) return hay.includes(tokens[0]);
  return tokens.every(tok => hay.includes(tok));
}

export function shopSearchHaystack(shop: MetaShop): string {
  const parts: string[] = [
    shop.name, shop.title, shop.subtitle, shop.collectionText, shop.footerText,
    shop.website, shop.address,
    shop.directoryCategory, shop.directorySubcategory,
    ...(shop.directoryCats || []).flatMap(c => [c.fa, c.en, c.ar, c.zh]),
    shop.directorySub?.fa, shop.directorySub?.en, shop.directorySub?.ar,
    keywordsHaystack(shop.searchKeywords),
    ...I18N_FLAT(shop.i18n),
    ...(shop.pages || []).flatMap(p => [p.name, p.nameEn, p.desc, p.descEn]),
    ...(shop.products || []).flatMap(p => [
      p.name, p.sku, p.description, p.group, p.subcategory, p.hsCode,
      keywordsHaystack(p.searchKeywords),
      ...I18N_FLAT(p.i18n),
      ...(p.priceOptions || []).flatMap(o => [o.label, o.labelEn]),
    ]),
  ];
  return parts.filter(Boolean).join(' ');
}

/** Product matches search term — includes shop-level keywords inherited for discovery. */
export function productSearchHaystack(shop: MetaShop, p: MetaShopProduct): string {
  const parts: string[] = [
    p.name, p.sku, p.description, p.group, p.subcategory, p.hsCode,
    keywordsHaystack(p.searchKeywords),
    keywordsHaystack(shop.searchKeywords),
    ...I18N_FLAT(p.i18n),
    ...(p.priceOptions || []).flatMap(o => [o.label, o.labelEn]),
  ];
  return parts.filter(Boolean).join(' ');
}

export function shopMatchesSearch(shop: MetaShop, q: string): boolean {
  if (!q.trim()) return true;
  return textMatchesSearchQuery(shopSearchHaystack(shop), q);
}

export function productMatchesSearch(shop: MetaShop, p: MetaShopProduct, q: string): boolean {
  if (!q.trim()) return true;
  return textMatchesSearchQuery(productSearchHaystack(shop, p), q);
}
