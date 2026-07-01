import { MetaShop, MetaShopProduct, MetaShopPriceMarkupHistoryEntry } from '../types';

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
    priceTiers: p.priceTiers?.map(t => ({
      ...t,
      basePrice: t.basePrice ?? t.price,
    })),
  };
}

export function anchorUnitPrice(p: MetaShopProduct, optId?: string): number {
  const tiers = p.priceTiers || [];
  if (tiers.length) {
    const t = tiers.find(x => x.id === optId) || tiers[0];
    return t?.basePrice ?? t?.price ?? 0;
  }
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
      priceTiers: snap.priceTiers?.map(t => ({
        ...t,
        price: adjustStored(t.price, type, value) ?? t.price,
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
    priceTiers: snap.priceTiers?.map(t => ({
      ...t,
      price: t.basePrice ?? t.price,
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
  ) || !!snap.priceTiers?.some(t =>
    t.basePrice != null && Math.abs((t.price ?? 0) - t.basePrice) > 0.001,
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

export function metaShopTaxRateConfigured(shop: Pick<MetaShop, 'taxRate'>): number {
  const rate = shop.taxRate || 0;
  return rate > 0 ? rate : 0;
}

export function metaShopTaxAvailable(shop: Pick<MetaShop, 'taxRate'>): boolean {
  return metaShopTaxRateConfigured(shop) > 0;
}

/** Whether VAT is active for this shop (admin toggle; no customer override). */
export function metaShopTaxActive(shop: Pick<MetaShop, 'taxEnabled' | 'taxRate'>): boolean {
  if (shop.taxEnabled === false) return false;
  return metaShopTaxAvailable(shop);
}

/** @deprecated use metaShopTaxActive */
export const metaShopTaxDefaultOn = metaShopTaxActive;

export function computeMetaShopTax(
  amountBeforeTax: number,
  shop: Pick<MetaShop, 'taxRate' | 'taxInclusive'>,
  includeTax: boolean,
): { taxAmount: number; finalTotal: number } {
  const base = Math.max(0, amountBeforeTax);
  const rate = shop.taxRate || 0;
  const taxInclusive = !!shop.taxInclusive;
  if (!includeTax || rate <= 0) {
    return { taxAmount: 0, finalTotal: base };
  }
  const taxAmount = taxInclusive
    ? base - base / (1 + rate / 100)
    : base * rate / 100;
  const finalTotal = taxInclusive ? base : base + taxAmount;
  return { taxAmount, finalTotal };
}

export const MAX_PRICE_MARKUP_HISTORY = 40;

export function appendPriceMarkupHistory(
  existing: MetaShopPriceMarkupHistoryEntry[] | undefined,
  entry: Omit<MetaShopPriceMarkupHistoryEntry, 'id' | 'at'> & { at?: string },
  max = MAX_PRICE_MARKUP_HISTORY,
): MetaShopPriceMarkupHistoryEntry[] {
  const row: MetaShopPriceMarkupHistoryEntry = {
    id: `pmh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: entry.at || new Date().toISOString(),
    action: entry.action,
    markupType: entry.markupType,
    markupValue: entry.markupValue,
    productCount: entry.productCount,
    actor: entry.actor?.trim() || undefined,
  };
  return [row, ...(existing || [])].slice(0, max);
}

export function normalizePriceMarkupHistory(raw: unknown): MetaShopPriceMarkupHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: MetaShopPriceMarkupHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as MetaShopPriceMarkupHistoryEntry;
    const action = r.action;
    if (action !== 'commit' && action !== 'revert_all' && action !== 'temporary_clear') continue;
    out.push({
      id: String(r.id || `pmh-${out.length}`),
      at: String(r.at || new Date().toISOString()),
      action,
      markupType: r.markupType === 'percent' || r.markupType === 'amount' ? r.markupType : undefined,
      markupValue: r.markupValue != null ? Number(r.markupValue) : undefined,
      productCount: r.productCount != null ? Number(r.productCount) : undefined,
      actor: r.actor ? String(r.actor) : undefined,
    });
    if (out.length >= MAX_PRICE_MARKUP_HISTORY) break;
  }
  return out;
}

export function formatPriceMarkupHistoryLine(entry: MetaShopPriceMarkupHistoryEntry, T: boolean): string {
  const when = new Date(entry.at).toLocaleString(T ? 'fa-IR' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const actor = entry.actor ? (T ? ` — ${entry.actor}` : ` — ${entry.actor}`) : '';
  const count = entry.productCount ?? 0;

  if (entry.action === 'commit') {
    const v = entry.markupValue ?? 0;
    const inc = v > 0;
    const abs = Math.abs(v);
    if (entry.markupType === 'percent') {
      return T
        ? `${when}: ${inc ? 'افزایش' : 'کاهش'} ${abs}٪ سود/مارک‌آپ روی ${count} محصول (ثبت در قیمت پایه)${actor}`
        : `${when}: ${inc ? '+' : ''}${v}% markup on ${count} products (committed to base)${actor}`;
    }
    return T
      ? `${when}: ${inc ? 'افزایش' : 'کاهش'} ${abs} مبلغ روی ${count} محصول (ثبت در قیمت پایه)${actor}`
      : `${when}: ${inc ? '+' : ''}${v} amount on ${count} products (committed to base)${actor}`;
  }
  if (entry.action === 'revert_all') {
    return T
      ? `${when}: برگشت ${count} محصول به قیمت پایه${actor}`
      : `${when}: reverted ${count} products to base price${actor}`;
  }
  return T
    ? `${when}: لغو تغییر موقت قیمت${actor}`
    : `${when}: cleared temporary price adjustment${actor}`;
}
