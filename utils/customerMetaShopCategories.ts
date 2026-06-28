import type { MetaShop, MetaShopDirCat, MetaShopProduct } from '../types';
import { categoryKey, normalizeShopCategories } from './metaShopCategories';

export type CustomerCategory = { key: string; fa: string; en?: string };

export function categoryEntryToCustomer(entry: string | MetaShopDirCat): CustomerCategory {
  if (typeof entry === 'string') {
    const k = entry.trim();
    return { key: k, fa: k };
  }
  const fa = (entry.fa || entry.en || '').trim();
  const en = entry.en?.trim();
  return { key: fa || en || '', fa: fa || en || '', en: en || undefined };
}

/** Build category list from shop + products (fills gaps from product groups). */
export function seedCustomerCategories(
  shop: Pick<MetaShop, 'categories' | 'groupI18n' | 'groupLabels' | 'products'>,
  products: MetaShopProduct[],
): { categories: (string | MetaShopDirCat)[]; groupI18n: Record<string, Record<string, string>> } {
  const groupI18n = { ...(shop.groupI18n || shop.groupLabels || {}) };
  const keys = normalizeShopCategories(shop.categories, products);
  const existing = (shop.categories || []).map(categoryEntryToCustomer);
  const cats: (string | MetaShopDirCat)[] = shop.categories?.length ? [...shop.categories] : [];

  const ensureKey = (key: string) => {
    if (!key || cats.some(c => categoryKey(c) === key)) return;
    const labels = groupI18n[key];
    const en = labels?.en?.trim();
    cats.push(en ? { fa: key, en } : key);
  };

  keys.forEach(ensureKey);
  existing.forEach(c => ensureKey(c.key));

  return { categories: cats, groupI18n };
}

export function customerCategoriesList(
  categories: (string | MetaShopDirCat)[],
  groupI18n: Record<string, Record<string, string>>,
): CustomerCategory[] {
  const seen = new Set<string>();
  const out: CustomerCategory[] = [];
  for (const c of categories) {
    const item = categoryEntryToCustomer(c);
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    const en = item.en || groupI18n[item.key]?.en;
    out.push({ ...item, en: en || undefined });
  }
  return out;
}

export function categoryLabelFa(c: CustomerCategory, lang: 'fa' | 'en'): string {
  if (lang === 'en' && c.en) return c.en;
  return c.fa;
}

export function addCustomerCategory(
  categories: (string | MetaShopDirCat)[],
  groupI18n: Record<string, Record<string, string>>,
  nameFa: string,
  nameEn?: string,
): { categories: (string | MetaShopDirCat)[]; groupI18n: Record<string, Record<string, string>> } {
  const fa = nameFa.trim();
  if (!fa) return { categories, groupI18n };
  if (categories.some(c => categoryKey(c) === fa)) return { categories, groupI18n };
  const en = nameEn?.trim();
  const entry: string | MetaShopDirCat = en ? { fa, en } : fa;
  const gi18n = { ...groupI18n };
  if (en) gi18n[fa] = { ...(gi18n[fa] || {}), en };
  return { categories: [...categories, entry], groupI18n: gi18n };
}

export function renameCustomerCategory(
  categories: (string | MetaShopDirCat)[],
  groupI18n: Record<string, Record<string, string>>,
  products: MetaShopProduct[],
  oldKey: string,
  newFa: string,
  newEn?: string,
): {
  categories: (string | MetaShopDirCat)[];
  groupI18n: Record<string, Record<string, string>>;
  products: MetaShopProduct[];
} {
  const fa = newFa.trim();
  if (!fa || fa === oldKey) {
    const en = newEn?.trim();
    const nextCats = categories.map(c => categoryKey(c) === oldKey ? (en ? { fa: oldKey, en } : oldKey) : c);
    const gi18n = { ...groupI18n };
    if (en) gi18n[oldKey] = { ...(gi18n[oldKey] || {}), en };
    return { categories: nextCats, groupI18n: gi18n, products };
  }
  const en = newEn?.trim();
  const nextCats = categories
    .filter(c => categoryKey(c) !== fa)
    .map(c => (categoryKey(c) === oldKey ? (en ? { fa, en } : fa) : c));
  if (!nextCats.some(c => categoryKey(c) === fa)) {
    nextCats.push(en ? { fa, en } : fa);
  }
  const gi18n = { ...groupI18n };
  if (gi18n[oldKey]) {
    gi18n[fa] = { ...gi18n[oldKey], ...(en ? { en } : {}) };
    delete gi18n[oldKey];
  } else if (en) gi18n[fa] = { en };

  const nextProducts = products.map(p =>
    p.group === oldKey ? { ...p, group: fa } : p,
  );
  return { categories: nextCats, groupI18n: gi18n, products: nextProducts };
}

export function removeCustomerCategory(
  categories: (string | MetaShopDirCat)[],
  groupI18n: Record<string, Record<string, string>>,
  products: MetaShopProduct[],
  key: string,
): {
  categories: (string | MetaShopDirCat)[];
  groupI18n: Record<string, Record<string, string>>;
  products: MetaShopProduct[];
} {
  const gi18n = { ...groupI18n };
  delete gi18n[key];
  return {
    categories: categories.filter(c => categoryKey(c) !== key),
    groupI18n: gi18n,
    products: products.map(p => (p.group === key ? { ...p, group: undefined, subcategory: undefined } : p)),
  };
}

export function countProductsInCategory(products: MetaShopProduct[], key: string): number {
  return products.filter(p => p.group === key).length;
}
