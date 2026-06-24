import type { MetaShopShipping } from '../types';

export interface ShippingQuote {
  amount: number;
  label: string;
  note?: string;
  isFree?: boolean;
  outside?: boolean;
  contactRequired?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const parseRegionList = (raw: string): string[] =>
  raw.split(/[,،;\n]+/).map(s => s.trim()).filter(Boolean);

export const cityInRegions = (city: string, regions: string[]): boolean => {
  const c = norm(city);
  if (!c) return regions.length === 0;
  return regions.some(r => {
    const n = norm(r);
    return n && (c === n || c.includes(n) || n.includes(c));
  });
};

export const computeShippingQuote = (
  shipping: MetaShopShipping | undefined,
  subtotal: number,
  city: string,
  labelOf: (fa?: string, en?: string) => string,
): ShippingQuote | null => {
  if (!shipping?.enabled) return null;
  const label = labelOf(shipping.label || 'هزینه ارسال', shipping.labelEn || 'Shipping');
  const regions = shipping.coveredRegions || [];
  const inZone = regions.length === 0 || cityInRegions(city, regions);

  if (!inZone) {
    const note = labelOf(
      shipping.outsideNote || 'برای سایر شهرها هزینه ارسال پس از هماهنگی محاسبه می‌شود.',
      shipping.outsideNoteEn || 'Shipping to other cities will be quoted after contact.',
    );
    if (shipping.outsideMode === 'fee' && (shipping.outsideFee ?? 0) > 0) {
      return { amount: shipping.outsideFee!, label, note, outside: true };
    }
    return { amount: 0, label, note, outside: true, contactRequired: true };
  }

  const freeAbove = shipping.freeAbove ?? 0;
  if (freeAbove > 0 && subtotal >= freeAbove) {
    const freeLabel = labelOf(shipping.freeLabel || 'ارسال رایگان', shipping.freeLabelEn || 'Free shipping');
    return { amount: 0, label: freeLabel, isFree: true, note: shipping.regionsNote || shipping.regionsNoteEn ? labelOf(shipping.regionsNote, shipping.regionsNoteEn) : undefined };
  }

  const amount = Math.max(0, shipping.flatAmount ?? 0);
  const note = labelOf(shipping.regionsNote, shipping.regionsNoteEn) || undefined;
  return { amount, label, note };
};
