import { MetaShop, MetaShopProduct } from '../types';

export type PriceAdjustType = 'percent' | 'amount';

export function resolvePriceMarkup(
  shop: MetaShop,
  product: MetaShopProduct,
): { type?: PriceAdjustType; value?: number } {
  if (product.priceMarkupType && (product.priceMarkupValue ?? 0) !== 0) {
    return { type: product.priceMarkupType, value: product.priceMarkupValue };
  }
  if (shop.priceMarkupType && (shop.priceMarkupValue ?? 0) !== 0) {
    return { type: shop.priceMarkupType, value: shop.priceMarkupValue };
  }
  return {};
}

export function hasPriceMarkup(shop: MetaShop, product: MetaShopProduct): boolean {
  const mk = resolvePriceMarkup(shop, product);
  return !!mk.type && (mk.value ?? 0) !== 0;
}

export function applyPriceMarkup(
  base: number | undefined,
  type?: PriceAdjustType,
  value?: number,
): number | undefined {
  if (base == null || !type || !(value ?? 0)) return base;
  const v = value!;
  const result = type === 'percent' ? base * (1 + v / 100) : base + v;
  return Math.max(0, Math.round(result * 100) / 100);
}

export function markedUpPrice(
  shop: MetaShop,
  product: MetaShopProduct,
  base: number | undefined,
): number | undefined {
  const mk = resolvePriceMarkup(shop, product);
  return applyPriceMarkup(base, mk.type, mk.value);
}

const adjustStored = (n: number | undefined, type: PriceAdjustType, value: number): number | undefined => {
  if (n == null) return n;
  return applyPriceMarkup(n, type, value);
};

/** Permanently add markup into stored prices (price, pack, rate options). */
export function commitMarkupToProducts(
  products: MetaShopProduct[],
  type: PriceAdjustType,
  value: number,
): MetaShopProduct[] {
  if (!value) return products;
  return products.map(p => ({
    ...p,
    price: adjustStored(p.price, type, value),
    packPrice: adjustStored(p.packPrice, type, value),
    priceOptions: p.priceOptions?.map(o => ({
      ...o,
      price: adjustStored(o.price, type, value) ?? o.price,
    })),
    priceMarkupType: undefined,
    priceMarkupValue: undefined,
  }));
}

export function resolveShowStrikethroughPrice(shop: MetaShop, product: MetaShopProduct): boolean {
  if (product.showStrikethroughPrice != null) return product.showStrikethroughPrice;
  if (shop.showStrikethroughPrice != null) return shop.showStrikethroughPrice;
  return true;
}

export function promoLabelText(
  product: MetaShopProduct,
  uiLang: string,
  fallbackLang = 'en',
): string {
  const direct = product.i18n?.[uiLang]?.promoLabel;
  if (direct?.trim()) return direct.trim();
  if (uiLang !== fallbackLang) {
    const fb = product.i18n?.[fallbackLang]?.promoLabel;
    if (fb?.trim()) return fb.trim();
  }
  return (product.promoLabel || '').trim();
}

export const PROMO_LABEL_PRESETS_FA = ['عرض خاص', 'پیشنهاد ویژه', 'Best offer', 'Hot deal', 'Limited offer'] as const;
