import { MetaShop, MetaShopProduct, MetaShopDiscount, MetaShopType } from '../types';
import { defaultRealEstate } from './metaShopRealEstate';

/** Shop-level fields a customer portal user may change. */
export const CUSTOMER_EDITABLE_SHOP_FIELDS = [
  'coverImage', 'logo',
  'title', 'subtitle', 'collectionText',
  'phone', 'whatsapp', 'email', 'website', 'address', 'footerText',
  'seoTitle', 'seoDescription', 'seoImage',
  'currency', 'displayCurrencies', 'defaultLang', 'languages', 'i18n',
  'categories', 'groupI18n',
  'hidePrices', 'hidePriceText',
  'priceMarkupType', 'priceMarkupValue',
  'products', 'discounts',
] as const;

export type CustomerEditableShopField = typeof CUSTOMER_EDITABLE_SHOP_FIELDS[number];

/** Per-product fields customers may edit (admin-only fields like sku/group stay intact). */
export const CUSTOMER_EDITABLE_PRODUCT_FIELDS = [
  'name', 'description', 'images', 'i18n',
  'group', 'subcategory',
  'price', 'packPrice', 'currency',
  'discountType', 'discountValue',
  'priceMarkupType', 'priceMarkupValue',
  'promoLabel',
  'hidePrice', 'hidePriceText',
  'outOfStock',
] as const;

export type CustomerEditableProductField = typeof CUSTOMER_EDITABLE_PRODUCT_FIELDS[number];

export function customerCanAccessShop(metaShopIds: string[] | undefined, shopId: string): boolean {
  return !!metaShopIds?.includes(shopId);
}

export function pickCustomerEditableFields(shop: MetaShop): Partial<MetaShop> {
  const out: Partial<MetaShop> = {};
  for (const key of CUSTOMER_EDITABLE_SHOP_FIELDS) {
    if (key === 'products' || key === 'discounts') continue;
    const val = shop[key];
    if (val !== undefined) {
      if (key === 'i18n') (out as MetaShop).i18n = { ...(val as MetaShop['i18n']) };
      else if (key === 'languages') (out as MetaShop).languages = [...(val as MetaShop['languages'] || [])];
      else if (key === 'displayCurrencies') (out as MetaShop).displayCurrencies = [...(val as MetaShop['displayCurrencies'] || [])];
      else if (key === 'categories') (out as MetaShop).categories = [...(val as MetaShop['categories'] || [])];
      else if (key === 'groupI18n') (out as MetaShop).groupI18n = { ...(val as MetaShop['groupI18n']) };
      else (out as Record<string, unknown>)[key] = val;
    }
  }
  return out;
}

export function pickCustomerEditableProduct(p: MetaShopProduct): MetaShopProduct {
  const out: MetaShopProduct = { id: p.id, name: p.name, images: [...(p.images || [])] };
  for (const key of CUSTOMER_EDITABLE_PRODUCT_FIELDS) {
    if (key === 'name' || key === 'images') continue;
    const val = p[key as CustomerEditableProductField];
    if (val !== undefined) Object.assign(out, { [key]: val });
  }
  return out;
}

export function mergeCustomerProductEdits(existing: MetaShopProduct, edits: MetaShopProduct): MetaShopProduct {
  const merged = { ...existing };
  for (const key of CUSTOMER_EDITABLE_PRODUCT_FIELDS) {
    if (key in edits) (merged as Record<string, unknown>)[key] = edits[key as CustomerEditableProductField];
  }
  if (edits.priceOptions && existing.priceOptions?.length) {
    const pmap = new Map(edits.priceOptions.map(o => [o.id, o]));
    merged.priceOptions = existing.priceOptions.map(o => {
      const e = pmap.get(o.id);
      if (!e) return o;
      return { ...o, price: e.price ?? o.price, currency: e.currency ?? o.currency };
    });
  }
  if (edits.i18n) {
    merged.i18n = { ...(existing.i18n || {}) };
    for (const [langCode, fields] of Object.entries(edits.i18n)) {
      merged.i18n[langCode] = { ...(merged.i18n[langCode] || {}), ...fields };
    }
  }
  return merged;
}

/** Blank product a customer can add to their shop. */
export function newCustomerProduct(currency: string, shopType?: MetaShopType, lang: 'fa' | 'en' = 'fa'): MetaShopProduct {
  const p: MetaShopProduct = {
    id: `p-${Date.now()}`,
    name: lang === 'fa' ? 'محصول جدید' : 'New product',
    images: [],
    active: true,
    price: 0,
  };
  if (shopType === 'realestate') p.realEstate = defaultRealEstate();
  return p;
}

/** Duplicate an existing product (editable fields + category; new id). */
export function duplicateCustomerProduct(source: MetaShopProduct, lang: 'fa' | 'en' = 'fa'): MetaShopProduct {
  const suffix = lang === 'fa' ? ' (کپی)' : ' (copy)';
  return {
    id: `p-${Date.now()}`,
    name: (source.name || (lang === 'fa' ? 'محصول' : 'Product')) + suffix,
    description: source.description,
    images: [...(source.images || [])],
    i18n: source.i18n ? JSON.parse(JSON.stringify(source.i18n)) as MetaShopProduct['i18n'] : undefined,
    price: source.price,
    packPrice: source.packPrice,
    hidePrice: source.hidePrice,
    hidePriceText: source.hidePriceText,
    outOfStock: source.outOfStock,
    discountType: source.discountType,
    discountValue: source.discountValue,
    priceMarkupType: source.priceMarkupType,
    priceMarkupValue: source.priceMarkupValue,
    promoLabel: source.promoLabel,
    group: source.group,
    subcategory: source.subcategory,
    unit: source.unit,
    priceOptions: source.priceOptions?.map(o => ({
      ...o,
      id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    })),
    active: true,
  };
}

function buildCustomerNewProduct(p: MetaShopProduct): MetaShopProduct {
  return {
    id: p.id,
    name: p.name || 'محصول جدید',
    images: p.images || [],
    active: p.active !== false,
    description: p.description,
    price: p.price,
    packPrice: p.packPrice,
    hidePrice: p.hidePrice,
    hidePriceText: p.hidePriceText,
    outOfStock: p.outOfStock,
    discountType: p.discountType,
    discountValue: p.discountValue,
    priceMarkupType: p.priceMarkupType,
    priceMarkupValue: p.priceMarkupValue,
    promoLabel: p.promoLabel,
    i18n: p.i18n,
    group: p.group,
    subcategory: p.subcategory,
    sku: p.sku,
    unit: p.unit,
    priceOptions: p.priceOptions,
    realEstate: p.realEstate,
  };
}

/** Merge only whitelisted customer edits onto the full shop record. */
export function mergeCustomerShopEdits(existing: MetaShop, edits: Partial<MetaShop>): MetaShop {
  const merged = { ...existing };
  for (const key of CUSTOMER_EDITABLE_SHOP_FIELDS) {
    if (key === 'products' || key === 'discounts' || key === 'i18n') continue;
    if (key in edits) (merged as Record<string, unknown>)[key] = edits[key as CustomerEditableShopField];
  }
  if (edits.i18n) {
    merged.i18n = { ...(existing.i18n || {}) };
    for (const [langCode, fields] of Object.entries(edits.i18n)) {
      merged.i18n[langCode] = { ...(merged.i18n[langCode] || {}), ...fields };
    }
  }
  if (edits.products) {
    const existingMap = new Map((existing.products || []).map(p => [p.id, p]));
    merged.products = edits.products.map(e => {
      const ex = existingMap.get(e.id);
      return ex ? mergeCustomerProductEdits(ex, e) : buildCustomerNewProduct(e);
    });
  }
  if (edits.discounts !== undefined) {
    merged.discounts = edits.discounts as MetaShopDiscount[];
  }
  return merged;
}
