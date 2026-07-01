import type { MetaShop, MetaShopProduct } from '../types';

/** Common export contract terms (Incoterms). */
export const INCOTERM_PRESETS = ['EXW', 'FOB', 'CIF', 'DDP', 'CFR', 'FCA'] as const;

export type IncotermPreset = typeof INCOTERM_PRESETS[number];

export const normalizeIncoterms = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const t = String(item || '').trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
};

export const resolveProductIncoterms = (
  shop: Pick<MetaShop, 'defaultIncoterms'>,
  product: Pick<MetaShopProduct, 'incoterms'>,
): string[] => {
  const own = normalizeIncoterms(product.incoterms);
  if (own.length) return own;
  return normalizeIncoterms(shop.defaultIncoterms);
};

export const resolveProductOrigin = (
  shop: Pick<MetaShop, 'defaultOrigin'>,
  product: Pick<MetaShopProduct, 'origin'>,
): { name: string; flagUrl?: string } | undefined => {
  if (product.origin?.name?.trim()) return product.origin;
  if (shop.defaultOrigin?.name?.trim()) return shop.defaultOrigin;
  return undefined;
};

export const toggleIncoterm = (current: string[], term: string): string[] => {
  const t = term.trim().toUpperCase();
  if (!t) return current;
  const set = new Set(normalizeIncoterms(current));
  if (set.has(t)) set.delete(t);
  else set.add(t);
  return [...set];
};

export const applyIncotermsToProducts = (
  products: MetaShopProduct[],
  terms: string[],
  opts: { emptyOnly?: boolean } = {},
): MetaShopProduct[] => {
  const normalized = normalizeIncoterms(terms);
  if (!normalized.length) return products;
  return products.map(p => {
    if (opts.emptyOnly && normalizeIncoterms(p.incoterms).length) return p;
    return { ...p, incoterms: normalized };
  });
};

export const applyOriginToProducts = (
  products: MetaShopProduct[],
  origin: { name: string; flagUrl?: string } | undefined,
  emptyOnly = false,
): MetaShopProduct[] => {
  if (!origin?.name?.trim()) return products;
  const o = { name: origin.name.trim(), flagUrl: origin.flagUrl?.trim() || undefined };
  return products.map(p => {
    if (emptyOnly && p.origin?.name?.trim()) return p;
    return { ...p, origin: o };
  });
};

export const clearIncotermsFromProducts = (products: MetaShopProduct[]): MetaShopProduct[] =>
  products.map(p => ({ ...p, incoterms: undefined }));

export const clearOriginFromProducts = (products: MetaShopProduct[]): MetaShopProduct[] =>
  products.map(p => ({ ...p, origin: undefined }));
