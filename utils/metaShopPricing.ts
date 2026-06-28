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

/** Snapshot base prices from current prices when not yet stored. */
export function ensureProductBaseSnapshot(p: MetaShopProduct): MetaShopProduct {
  return {
    ...p,
    basePrice: p.basePrice ?? p.price,
    basePackPrice: p.basePackPrice ?? p.packPrice,
    priceOptions: p.priceOptions?.map(o => ({
      ...o,
      basePrice: o.basePrice ?? o.price,
    })),
  };
}

export function anchorUnitPrice(p: MetaShopProduct, optId?: string): number {
  const opts = p.priceOptions || [];
  if (opts.length) {
    const o = opts.find(x => x.id === optId) || opts[0];
    return o?.basePrice ?? o?.price ?? 0;
  }
  return p.basePrice ?? p.price ?? 0;
}

export function anchorPackPrice(p: MetaShopProduct): number | undefined {
  if (p.basePackPrice != null) return p.basePackPrice;
  return p.packPrice;
}

export function anchorOptionPrice(opt: { basePrice?: number; price: number }): number {
  return opt.basePrice ?? opt.price;
}

/** Permanently adjust stored prices; preserves basePrice anchors for revert. */
export function commitMarkupToProducts(
  products: MetaShopProduct[],
  type: PriceAdjustType,
  value: number,
): MetaShopProduct[] {
  if (!value) return products;
  return products.map(p => {
    const snap = ensureProductBaseSnapshot(p);
    return {
      ...snap,
      price: adjustStored(snap.price, type, value),
      packPrice: snap.packPrice != null ? adjustStored(snap.packPrice, type, value) : undefined,
      priceOptions: snap.priceOptions?.map(o => ({
        ...o,
        price: adjustStored(o.price, type, value) ?? o.price,
      })),
      priceMarkupType: undefined,
      priceMarkupValue: undefined,
    };
  });
}

/** Restore selling prices + clear temporary markup/discount to basePrice anchors. */
export function revertProductToBase(p: MetaShopProduct): MetaShopProduct {
  const snap = ensureProductBaseSnapshot(p);
  return {
    ...snap,
    price: snap.basePrice ?? snap.price,
    packPrice: snap.basePackPrice ?? snap.packPrice,
    priceOptions: snap.priceOptions?.map(o => ({
      ...o,
      price: o.basePrice ?? o.price,
    })),
    priceMarkupType: undefined,
    priceMarkupValue: undefined,
    discountType: undefined,
    discountValue: undefined,
  };
}

export function revertAllProductsToBase(products: MetaShopProduct[]): MetaShopProduct[] {
  return products.map(revertProductToBase);
}

export function productHasPriceDrift(p: MetaShopProduct): boolean {
  const snap = ensureProductBaseSnapshot(p);
  if (snap.basePrice != null && snap.price != null && Math.abs(snap.price - snap.basePrice) > 0.001) return true;
  if (snap.basePackPrice != null && snap.packPrice != null && Math.abs(snap.packPrice - snap.basePackPrice) > 0.001) return true;
  if (snap.priceMarkupType && (snap.priceMarkupValue ?? 0) !== 0) return true;
  if (snap.discountType && (snap.discountValue ?? 0) > 0) return true;
  return !!snap.priceOptions?.some(o =>
    o.basePrice != null && Math.abs((o.price ?? 0) - o.basePrice) > 0.001,
  );
}

/** When user sets a new manual price, update both selling price and base anchor. */
export function patchProductSellingPrice(
  p: MetaShopProduct,
  patch: { price?: number; packPrice?: number; priceOptions?: MetaShopProduct['priceOptions'] },
): Partial<MetaShopProduct> {
  const out: Partial<MetaShopProduct> = { ...patch };
  if (patch.price != null) out.basePrice = patch.price;
  if (patch.packPrice != null) out.basePackPrice = patch.packPrice;
  if (patch.priceOptions) {
    out.priceOptions = patch.priceOptions.map(o => ({
      ...o,
      basePrice: o.basePrice ?? o.price,
    }));
  }
  return out;
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
