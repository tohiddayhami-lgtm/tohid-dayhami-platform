import type { MetaShop, MetaShopDirCat } from '../types';

type CatEntry = string | MetaShopDirCat | null | undefined;

/** Stable key for filtering — matches product.group (usually Persian / fa) */
export const categoryKey = (entry: CatEntry): string => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  const o = entry as MetaShopDirCat & { name?: string };
  return (o.fa || o.name || o.en || '').trim();
};

/** Display label for a category pill / heading */
export const categoryLabel = (
  entry: CatEntry,
  uiLang: string,
  shop?: Pick<MetaShop, 'groupI18n' | 'groupLabels'>,
): string => {
  const key = categoryKey(entry);
  if (!key) return '';
  if (typeof entry === 'string') return translateProductGroup(shop || {}, key, uiLang);
  const o = entry as MetaShopDirCat & { name?: string; nameEn?: string; nameAr?: string };
  if (uiLang === 'fa') return o.fa || o.name || key;
  if (uiLang === 'ar') return o.ar || o.nameAr || o.en || o.nameEn || translateProductGroup(shop || {}, key, uiLang);
  if (uiLang === 'en') return o.en || o.nameEn || translateProductGroup(shop || {}, key, uiLang);
  const fromMap = translateProductGroup(shop || {}, key, uiLang);
  if (fromMap !== key) return fromMap;
  return o.en || o.nameEn || o.fa || key;
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

export const translateProductGroup = (
  shop: Pick<MetaShop, 'groupI18n' | 'groupLabels'>,
  groupKey: string,
  uiLang: string,
  productI18n?: Record<string, Record<string, string>>,
): string => {
  if (!groupKey) return '';
  const fromProduct = productI18n?.[uiLang]?.group;
  if (fromProduct) return fromProduct;
  if (uiLang === 'fa') return groupKey;
  const map = shop.groupI18n || shop.groupLabels;
  const labels = map?.[groupKey];
  if (labels?.[uiLang]) return labels[uiLang];
  if (labels?.en) return labels.en;
  if (productI18n?.en?.group) return productI18n.en.group;
  return groupKey;
};

export const translateProductSubcategory = (
  subKey: string,
  uiLang: string,
  productI18n?: Record<string, Record<string, string>>,
): string => {
  if (!subKey) return '';
  const fromProduct = productI18n?.[uiLang]?.subcategory;
  if (fromProduct) return fromProduct;
  if (uiLang === 'fa') return subKey;
  if (productI18n?.en?.subcategory) return productI18n.en.subcategory;
  return subKey;
};

export const findCategoryEntry = (categories: MetaShop['categories'], key: string): CatEntry => {
  if (!categories?.length) return key;
  const hit = categories.find(c => categoryKey(c as CatEntry) === key);
  return hit ?? key;
};
