import type { MetaShop, MetaShopDirCat, MetaShopProduct } from '../types';

type CatEntry = string | MetaShopDirCat | null | undefined;

type ShopGroupCtx = Pick<MetaShop, 'groupI18n' | 'groupLabels' | 'categories' | 'defaultLang' | 'products'>;

const RTL_LANGS = new Set(['fa', 'ar', 'he', 'ur']);

/** True when the visible text is appropriate for the active UI language (script heuristic). */
export const textMatchesLang = (text: string, lang: string): boolean => {
  if (!text?.trim()) return false;
  const rtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  const latin = /[A-Za-z]/.test(text);
  const rtlLang = RTL_LANGS.has(lang) || lang.startsWith('fa') || lang.startsWith('ar');
  if (rtlLang) return rtl || (!latin && !rtl);
  if (lang === 'en' || lang.startsWith('en')) return latin && !rtl;
  return true;
};

/** Stable key for filtering — matches product.group */
export const categoryKey = (entry: CatEntry): string => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  const o = entry as MetaShopDirCat & { name?: string };
  return (o.fa || o.name || o.en || '').trim();
};

/** Label from a bilingual category object only — no i18n map / recursion. */
const labelFromCategoryObject = (entry: CatEntry, uiLang: string): string | undefined => {
  if (!entry || typeof entry === 'string') return undefined;
  const o = entry as MetaShopDirCat & { name?: string; nameEn?: string; nameAr?: string };
  if (uiLang === 'fa') return (o.fa || o.name || '').trim() || undefined;
  if (uiLang === 'ar') return (o.ar || o.nameAr || '').trim() || undefined;
  if (uiLang === 'en') return (o.en || o.nameEn || '').trim() || undefined;
  const mapped = (o as Record<string, string | undefined>)[uiLang];
  return mapped?.trim() || undefined;
};

/** Display label for a category pill / heading */
export const categoryLabel = (
  entry: CatEntry,
  uiLang: string,
  shop?: ShopGroupCtx,
): string => {
  const key = categoryKey(entry);
  if (!key) return '';
  const fromObject = labelFromCategoryObject(entry, uiLang);
  if (fromObject) return fromObject;
  return translateProductGroup(shop || {}, key, uiLang);
};

/** Ordered unique category keys from shop.categories or product groups */
export const normalizeShopCategories = (raw: unknown, products?: { group?: string }[]): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const k = categoryKey(item as CatEntry);
      if (k && !seen.has(k)) { seen.add(k); keys.push(k); }
    }
  }
  if (keys.length) return keys;
  (products || []).forEach(p => {
    const k = (p.group || '').trim();
    if (k && !seen.has(k)) { seen.add(k); keys.push(k); }
  });
  return keys;
};

const peerGroupLabel = (products: MetaShopProduct[] | undefined, groupKey: string, uiLang: string): string | undefined => {
  const hit = products?.find(p => p.group === groupKey && p.i18n?.[uiLang]?.group?.trim());
  return hit?.i18n?.[uiLang]?.group?.trim();
};

const peerSubLabel = (products: MetaShopProduct[] | undefined, subKey: string, uiLang: string): string | undefined => {
  const hit = products?.find(p => p.subcategory === subKey && p.i18n?.[uiLang]?.subcategory?.trim());
  return hit?.i18n?.[uiLang]?.subcategory?.trim();
};

export const translateProductGroup = (
  shop: ShopGroupCtx,
  groupKey: string,
  uiLang: string,
  productI18n?: Record<string, Record<string, string>>,
): string => {
  if (!groupKey) return '';

  const fromProduct = productI18n?.[uiLang]?.group?.trim();
  if (fromProduct) return fromProduct;

  const map = shop.groupI18n || shop.groupLabels;
  const labels = map?.[groupKey];
  if (labels?.[uiLang]?.trim()) return labels[uiLang].trim();

  const catEntry = findCategoryEntry(shop.categories, groupKey);
  const fromCat = labelFromCategoryObject(catEntry, uiLang);
  if (fromCat) return fromCat;

  const fromPeer = peerGroupLabel(shop.products, groupKey, uiLang);
  if (fromPeer) return fromPeer;

  if (textMatchesLang(groupKey, uiLang)) return groupKey;

  if (labels) {
    const def = shop.defaultLang || 'fa';
    if (labels[def]?.trim()) return labels[def].trim();
    if (RTL_LANGS.has(uiLang) && labels.fa?.trim()) return labels.fa.trim();
    if (labels.en?.trim()) return labels.en.trim();
    const any = Object.values(labels).find(v => v?.trim());
    if (any?.trim()) return any.trim();
  }

  const def = shop.defaultLang || 'fa';
  const fromPeerDef = peerGroupLabel(shop.products, groupKey, def);
  if (fromPeerDef && textMatchesLang(fromPeerDef, uiLang)) return fromPeerDef;

  return groupKey;
};

export const translateProductSubcategory = (
  subKey: string,
  uiLang: string,
  productI18n?: Record<string, Record<string, string>>,
  products?: MetaShopProduct[],
): string => {
  if (!subKey) return '';

  const fromProduct = productI18n?.[uiLang]?.subcategory?.trim();
  if (fromProduct) return fromProduct;

  const fromPeer = peerSubLabel(products, subKey, uiLang);
  if (fromPeer) return fromPeer;

  if (textMatchesLang(subKey, uiLang)) return subKey;

  if (productI18n) {
    const def = Object.keys(productI18n).find(l => productI18n[l]?.subcategory?.trim());
    const alt = def ? productI18n[def]?.subcategory?.trim() : undefined;
    if (alt && textMatchesLang(alt, uiLang)) return alt;
  }

  const peerDef = products?.find(p => p.subcategory === subKey);
  const defLabel = peerDef?.i18n?.en?.subcategory?.trim() || peerDef?.i18n?.fa?.subcategory?.trim();
  if (defLabel && textMatchesLang(defLabel, uiLang)) return defLabel;

  return subKey;
};

export const findCategoryEntry = (categories: MetaShop['categories'], key: string): CatEntry => {
  if (!categories?.length) return key;
  const hit = categories.find(c => categoryKey(c as CatEntry) === key);
  return hit ?? key;
};
