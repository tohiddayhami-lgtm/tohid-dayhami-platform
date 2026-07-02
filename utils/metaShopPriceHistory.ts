import type {
  MetaShopPriceHistoryEntry,
  MetaShopPriceHistoryKind,
  MetaShopProduct,
} from '../types';
import type { PriceAdjustType } from './metaShopPricing';

export const META_SHOP_PRICE_HISTORY_MAX = 80;

export type PriceHistoryAction =
  | { kind: 'bulk_commit'; adjustType: PriceAdjustType; adjustValue: number; productCount: number; currency?: string }
  | { kind: 'bulk_revert'; productCount: number }
  | { kind: 'bulk_temp_clear'; adjustType?: PriceAdjustType; adjustValue?: number }
  | { kind: 'product_revert'; product: MetaShopProduct }
  | { kind: 'manual_edit'; product: MetaShopProduct; details: { field: string; from?: number; to?: number }[]; currency?: string };

const fmtNum = (n: number | undefined, currency?: string) => {
  if (n == null || Number.isNaN(n)) return '—';
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency ? `${s} ${currency}` : s;
};

const adjustLabelFa = (type: PriceAdjustType, value: number) => {
  const abs = Math.abs(value);
  const dir = value < 0 ? 'کاهش' : 'افزایش';
  return type === 'percent' ? `${dir} ${abs}٪` : `${dir} ${abs}`;
};

const adjustLabelEn = (type: PriceAdjustType, value: number) => {
  const abs = Math.abs(value);
  const dir = value < 0 ? 'Decrease' : 'Increase';
  return type === 'percent' ? `${dir} ${abs}%` : `${dir} ${abs}`;
};

export function buildPriceHistoryEntry(
  action: PriceHistoryAction,
  actor?: string,
): MetaShopPriceHistoryEntry {
  const at = new Date().toISOString();
  const id = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const by = actor?.trim() || undefined;

  switch (action.kind) {
    case 'bulk_commit': {
      const { adjustType, adjustValue, productCount, currency } = action;
      return {
        id, at, by, kind: 'bulk_commit', scope: 'shop',
        adjustType, adjustValue, productCount, currency,
        summaryFa: `${adjustLabelFa(adjustType, adjustValue)} — ثبت در قیمت پایه ${productCount} محصول`,
        summaryEn: `${adjustLabelEn(adjustType, adjustValue)} — committed to base prices (${productCount} products)`,
      };
    }
    case 'bulk_revert': {
      const { productCount } = action;
      return {
        id, at, by, kind: 'bulk_revert', scope: 'shop', productCount,
        summaryFa: `برگشت ${productCount} محصول به قیمت پایه`,
        summaryEn: `Reverted ${productCount} products to base prices`,
      };
    }
    case 'bulk_temp_clear': {
      const { adjustType, adjustValue } = action;
      const had = adjustType && adjustValue != null && adjustValue !== 0;
      return {
        id, at, by, kind: 'bulk_temp_clear', scope: 'shop',
        adjustType, adjustValue,
        summaryFa: had
          ? `لغو تغییر موقت فروشگاه (${adjustLabelFa(adjustType!, adjustValue!)})`
          : 'لغو تغییر موقت قیمت فروشگاه',
        summaryEn: had
          ? `Cleared temporary shop adjustment (${adjustLabelEn(adjustType!, adjustValue!)})`
          : 'Cleared temporary shop price adjustment',
      };
    }
    case 'product_revert': {
      const name = action.product.name || action.product.id;
      return {
        id, at, by, kind: 'product_revert', scope: 'product',
        productId: action.product.id, productName: name,
        summaryFa: `برگشت محصول «${name}» به قیمت پایه`,
        summaryEn: `Reverted product «${name}» to base price`,
      };
    }
    case 'manual_edit': {
      const name = action.product.name || action.product.id;
      const cur = action.currency;
      const detailStrFa = action.details.map(d => `${d.field}: ${fmtNum(d.from, cur)} → ${fmtNum(d.to, cur)}`).join(' · ');
      const detailStrEn = action.details.map(d => `${d.field}: ${fmtNum(d.from, cur)} → ${fmtNum(d.to, cur)}`).join(' · ');
      return {
        id, at, by, kind: 'manual_edit', scope: 'product',
        productId: action.product.id, productName: name, currency: cur,
        details: action.details,
        summaryFa: `ویرایش دستی «${name}» — ${detailStrFa}`,
        summaryEn: `Manual edit «${name}» — ${detailStrEn}`,
      };
    }
    default:
      return { id, at, by, kind: 'manual_edit' as MetaShopPriceHistoryKind, scope: 'shop' };
  }
}

export function appendPriceHistory(
  current: MetaShopPriceHistoryEntry[] | undefined,
  action: PriceHistoryAction,
  actor?: string,
): MetaShopPriceHistoryEntry[] {
  const entry = buildPriceHistoryEntry(action, actor);
  return [entry, ...(current || [])].slice(0, META_SHOP_PRICE_HISTORY_MAX);
}

export function appendPriceHistoryMany(
  current: MetaShopPriceHistoryEntry[] | undefined,
  actions: PriceHistoryAction[],
  actor?: string,
): MetaShopPriceHistoryEntry[] {
  if (!actions.length) return current || [];
  const added = actions.map(a => buildPriceHistoryEntry(a, actor));
  return [...added, ...(current || [])].slice(0, META_SHOP_PRICE_HISTORY_MAX);
}

const priceFingerprint = (p: MetaShopProduct): string =>
  JSON.stringify({
    price: p.price,
    basePrice: p.basePrice,
    packPrice: p.packPrice,
    basePackPrice: p.basePackPrice,
    priceOptions: p.priceOptions?.map(o => ({ id: o.id, price: o.price, basePrice: o.basePrice })),
    priceTiers: p.priceTiers?.map(t => ({ id: t.id, price: t.price, basePrice: t.basePrice })),
  });

const numChanged = (a?: number, b?: number) =>
  a != null && b != null && Math.abs(a - b) > 0.001;

const collectPriceDiffs = (
  before: MetaShopProduct,
  after: MetaShopProduct,
): { field: string; from?: number; to?: number }[] => {
  const out: { field: string; from?: number; to?: number }[] = [];
  if (numChanged(before.price, after.price)) out.push({ field: 'price', from: before.price, to: after.price });
  if (numChanged(before.basePrice, after.basePrice)) out.push({ field: 'basePrice', from: before.basePrice, to: after.basePrice });
  if (numChanged(before.packPrice, after.packPrice)) out.push({ field: 'packPrice', from: before.packPrice, to: after.packPrice });
  if (numChanged(before.basePackPrice, after.basePackPrice)) out.push({ field: 'basePackPrice', from: before.basePackPrice, to: after.basePackPrice });
  for (const o of after.priceOptions || []) {
    const prev = before.priceOptions?.find(x => x.id === o.id);
    if (prev && numChanged(prev.price, o.price)) out.push({ field: `opt:${o.label || o.id}`, from: prev.price, to: o.price });
  }
  for (const t of after.priceTiers || []) {
    const prev = before.priceTiers?.find(x => x.id === t.id);
    if (prev && numChanged(prev.price, t.price)) out.push({ field: `tier:${t.label || t.id}`, from: prev.price, to: t.price });
  }
  return out;
};

export function detectManualPriceEdits(
  before: MetaShopProduct[] | null | undefined,
  after: MetaShopProduct[],
  currency?: string,
): PriceHistoryAction[] {
  if (!before?.length) return [];
  const map = new Map(before.map(p => [p.id, p]));
  const actions: PriceHistoryAction[] = [];
  for (const p of after) {
    const prev = map.get(p.id);
    if (!prev) continue;
    if (priceFingerprint(prev) === priceFingerprint(p)) continue;
    const details = collectPriceDiffs(prev, p);
    if (!details.length) continue;
    actions.push({ kind: 'manual_edit', product: p, details, currency });
  }
  return actions;
}

export function cloneProductsBaseline(products: MetaShopProduct[]): MetaShopProduct[] {
  return products.map(p => ({ ...p }));
}

export function priceHistorySummary(entry: MetaShopPriceHistoryEntry, lang: 'fa' | 'en'): string {
  return (lang === 'fa' ? entry.summaryFa : entry.summaryEn) || entry.summaryFa || entry.summaryEn || entry.kind;
}
