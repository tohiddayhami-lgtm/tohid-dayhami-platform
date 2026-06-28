import type { MetaShopProduct, MetaShopPriceTier, MetaShopType } from '../types';

export const MAX_PRICE_TIERS = 3;

export const TIER_LABEL_PRESETS_FA = ['یک عدد', 'یک جعبه', 'یک کارتن', 'عمده'] as const;
export const TIER_LABEL_PRESETS_EN = ['Per unit', 'Per box', 'Per carton', 'Wholesale'] as const;

export type PurchaseOption = {
  id: string;
  label: string;
  labelEn?: string;
  price: number;
  basePrice?: number;
  currency?: string;
  unitsInPack?: number;
};

/** Selectable purchase options on the storefront (tiers for products, rates for services). */
export function productPurchaseOptions(p: MetaShopProduct, shopType?: MetaShopType): PurchaseOption[] {
  if (shopType === 'products' && p.priceTiers?.length) {
    return p.priceTiers.slice(0, MAX_PRICE_TIERS).map(t => ({
      id: t.id,
      label: t.label,
      labelEn: t.labelEn,
      price: t.price,
      basePrice: t.basePrice,
      currency: t.currency,
      unitsInPack: t.unitsInPack,
    }));
  }
  if (p.priceOptions?.length) {
    return p.priceOptions.map(o => ({
      id: o.id,
      label: o.label,
      labelEn: o.labelEn,
      price: o.price,
      basePrice: o.basePrice,
      currency: o.currency,
    }));
  }
  return [];
}

export function hasPurchaseOptions(p: MetaShopProduct, shopType?: MetaShopType): boolean {
  return productPurchaseOptions(p, shopType).length > 0;
}

export function newPriceTier(partial?: Partial<MetaShopPriceTier>): MetaShopPriceTier {
  return {
    id: partial?.id || `tier-${Date.now()}`,
    label: partial?.label || '',
    labelEn: partial?.labelEn,
    price: partial?.price ?? 0,
    basePrice: partial?.basePrice,
    currency: partial?.currency,
    unitsInPack: partial?.unitsInPack,
  };
}

/** Build tiers from legacy unit + pack fields. */
export function seedTiersFromLegacy(p: MetaShopProduct): MetaShopPriceTier[] {
  const tiers: MetaShopPriceTier[] = [];
  if (p.price != null && p.price > 0) {
    tiers.push(newPriceTier({
      id: `tier-u-${p.id}`,
      label: 'یک عدد',
      labelEn: 'Per unit',
      price: p.price,
      basePrice: p.basePrice,
      currency: p.currency,
      unitsInPack: 1,
    }));
  }
  if (p.packPrice != null && p.packPrice > 0) {
    tiers.push(newPriceTier({
      id: `tier-p-${p.id}`,
      label: 'یک جعبه',
      labelEn: 'Per box',
      price: p.packPrice,
      basePrice: p.basePackPrice,
      currency: p.currency,
      unitsInPack: p.pack,
    }));
  }
  return tiers.slice(0, MAX_PRICE_TIERS);
}

/** Keep primary price + pack fields in sync with first two tiers. */
export function syncLegacyPricesFromTiers(p: MetaShopProduct): Partial<MetaShopProduct> {
  const tiers = p.priceTiers || [];
  if (!tiers.length) return {};
  const first = tiers[0];
  const second = tiers[1];
  const out: Partial<MetaShopProduct> = {
    price: first.price,
    basePrice: first.basePrice ?? first.price,
    currency: first.currency ?? p.currency,
  };
  if (second) {
    out.packPrice = second.price;
    out.basePackPrice = second.basePrice ?? second.price;
    if (second.unitsInPack != null) out.pack = second.unitsInPack;
  }
  return out;
}

export function tierUnitsHint(tier: PurchaseOption, unit?: string, T = true): string | undefined {
  if (!tier.unitsInPack || tier.unitsInPack <= 1) return undefined;
  const u = unit || (T ? 'عدد' : 'pcs');
  return T ? `${tier.unitsInPack} ${u}` : `${tier.unitsInPack} ${u}`;
}
