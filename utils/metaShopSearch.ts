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
  return (keywords || []).join(' ').toLowerCase();
}

export function shopSearchHaystack(shop: MetaShop): string {
  const parts: string[] = [
    shop.name, shop.title, shop.subtitle, shop.collectionText, shop.footerText,
    shop.website, shop.address,
    shop.directoryCategory, shop.directorySubcategory,
    ...(shop.directoryCats || []).flatMap(c => [c.fa, c.en, c.ar, c.zh]),
    shop.directorySub?.fa, shop.directorySub?.en, shop.directorySub?.ar,
    keywordsHaystack(shop.searchKeywords),
    ...(shop.pages || []).flatMap(p => [p.name, p.nameEn, p.desc, p.descEn]),
    ...(shop.products || []).flatMap(p => [
      p.name, p.sku, p.description, p.group, p.subcategory, p.hsCode,
      keywordsHaystack(p.searchKeywords),
      ...(p.priceOptions || []).flatMap(o => [o.label, o.labelEn]),
    ]),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Product matches search term — includes shop-level keywords inherited for discovery. */
export function productSearchHaystack(shop: MetaShop, p: MetaShopProduct): string {
  const parts: string[] = [
    p.name, p.sku, p.description, p.group, p.subcategory, p.hsCode,
    keywordsHaystack(p.searchKeywords),
    keywordsHaystack(shop.searchKeywords),
    ...(p.priceOptions || []).flatMap(o => [o.label, o.labelEn]),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function shopMatchesSearch(shop: MetaShop, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return shopSearchHaystack(shop).includes(term);
}

export function productMatchesSearch(shop: MetaShop, p: MetaShopProduct, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return productSearchHaystack(shop, p).includes(term);
}
