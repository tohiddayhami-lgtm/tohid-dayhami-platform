import { MetaShop } from '../types';

/** Fields a customer portal user may change on their assigned MetaShop(s). */
export const CUSTOMER_EDITABLE_SHOP_FIELDS = [
  'coverImage', 'logo',
  'title', 'subtitle', 'collectionText',
  'phone', 'whatsapp', 'email', 'website', 'address', 'footerText',
  'seoTitle', 'seoDescription', 'seoImage',
] as const;

export type CustomerEditableShopField = typeof CUSTOMER_EDITABLE_SHOP_FIELDS[number];

export function customerCanAccessShop(metaShopIds: string[] | undefined, shopId: string): boolean {
  return !!metaShopIds?.includes(shopId);
}

export function pickCustomerEditableFields(shop: MetaShop): Partial<MetaShop> {
  const out: Partial<MetaShop> = {};
  for (const key of CUSTOMER_EDITABLE_SHOP_FIELDS) {
    const val = shop[key];
    if (val !== undefined) (out as Record<string, unknown>)[key] = val;
  }
  return out;
}

/** Merge only whitelisted customer edits onto the full shop record. */
export function mergeCustomerShopEdits(existing: MetaShop, edits: Partial<MetaShop>): MetaShop {
  const merged = { ...existing };
  for (const key of CUSTOMER_EDITABLE_SHOP_FIELDS) {
    if (key in edits) (merged as Record<string, unknown>)[key] = edits[key as CustomerEditableShopField];
  }
  return merged;
}
