import { MetaShop, MetaShopProduct, MetaShopDiscount } from '../types';

/** Shop-level fields a customer portal user may change. */
export const CUSTOMER_EDITABLE_SHOP_FIELDS = [
  'coverImage', 'logo',
  'title', 'subtitle', 'collectionText',
  'phone', 'whatsapp', 'email', 'website', 'address', 'footerText',
  'seoTitle', 'seoDescription', 'seoImage',
  'products', 'discounts',
] as const;

export type CustomerEditableShopField = typeof CUSTOMER_EDITABLE_SHOP_FIELDS[number];

/** Per-product fields customers may edit (admin-only fields like sku/group stay intact). */
export const CUSTOMER_EDITABLE_PRODUCT_FIELDS = [
  'name', 'description', 'images',
  'price', 'packPrice', 'currency',
  'discountType', 'discountValue',
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
    if (val !== undefined) (out as Record<string, unknown>)[key] = val;
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
  return merged;
}

/** Merge only whitelisted customer edits onto the full shop record. */
export function mergeCustomerShopEdits(existing: MetaShop, edits: Partial<MetaShop>): MetaShop {
  const merged = { ...existing };
  for (const key of CUSTOMER_EDITABLE_SHOP_FIELDS) {
    if (key === 'products' || key === 'discounts') continue;
    if (key in edits) (merged as Record<string, unknown>)[key] = edits[key as CustomerEditableShopField];
  }
  if (edits.products) {
    const editMap = new Map(edits.products.map(p => [p.id, p]));
    merged.products = (existing.products || []).map(p => {
      const e = editMap.get(p.id);
      return e ? mergeCustomerProductEdits(p, e) : p;
    });
  }
  if (edits.discounts !== undefined) {
    merged.discounts = edits.discounts as MetaShopDiscount[];
  }
  return merged;
}
