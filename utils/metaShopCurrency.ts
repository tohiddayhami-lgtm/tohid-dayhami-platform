import type { MetaShop, MetaShopDisplayCurrency, MetaShopCurrencyPreset } from '../types';
import { formatMetaShopNumber } from './metaShopLang';

const PRESET_LABELS: Record<string, { fa: string; en: string }> = {
  OMR: { fa: 'ریال عمان', en: 'Omani Rial' },
  USD: { fa: 'دلار آمریکا', en: 'US Dollar' },
  AED: { fa: 'درهم امارات', en: 'UAE Dirham' },
  IRR: { fa: 'ریال ایران', en: 'Iranian Rial' },
  IRT: { fa: 'تومان', en: 'Iranian Toman' },
  EUR: { fa: 'یورو', en: 'Euro' },
  GBP: { fa: 'پوند انگلیس', en: 'British Pound' },
  SAR: { fa: 'ریال سعودی', en: 'Saudi Riyal' },
  QAR: { fa: 'ریال قطر', en: 'Qatari Riyal' },
  KWD: { fa: 'دینار کویت', en: 'Kuwaiti Dinar' },
  BHD: { fa: 'دینار بحرین', en: 'Bahraini Dinar' },
  CNY: { fa: 'یوآن چین', en: 'Chinese Yuan' },
};

/** Suggested market rates: 1 unit of base → target (editable in admin). */
export const DEFAULT_RATES_FROM: Record<string, Record<string, number>> = {
  EUR: { USD: 1.17, OMR: 0.445, AED: 4.31, SAR: 4.40, GBP: 0.86 },
  USD: { EUR: 0.854, OMR: 0.3846, AED: 3.6725, SAR: 3.75, IRT: 420000, IRR: 4200000 },
  OMR: { USD: 2.60, EUR: 2.25, AED: 9.55, SAR: 9.75 },
  AED: { OMR: 0.105, USD: 0.272, EUR: 0.23, SAR: 1.02 },
  SAR: { OMR: 0.102, USD: 0.267, AED: 0.98, EUR: 0.227 },
  IRR: { USD: 0.000024, OMR: 0.0000091, AED: 0.000087, IRT: 0.00024 },
  IRT: { USD: 0.0000024, OMR: 0.00000091, AED: 0.0000087, IRR: 10 },
};

export const CURRENCY_PRESETS = ['OMR', 'USD', 'AED', 'EUR', 'SAR', 'GBP', 'IRR', 'IRT', 'CNY', 'QAR', 'KWD', 'BHD'];

export const currencyPresetLabel = (code: string, lang: string): string => {
  const c = code.trim().toUpperCase();
  const p = PRESET_LABELS[c];
  if (!p) return c;
  return lang === 'fa' || lang === 'ar' ? p.fa : p.en;
};

export const displayCurrencyLabel = (entry: MetaShopDisplayCurrency, lang: string): string => {
  const code = entry.code.trim().toUpperCase();
  if (lang === 'fa' || lang === 'ar') return entry.label?.trim() || currencyPresetLabel(code, lang);
  return entry.labelEn?.trim() || entry.label?.trim() || currencyPresetLabel(code, lang);
};

export const shopBaseCurrency = (shop: MetaShop): string =>
  (shop.currency || 'USD').trim().toUpperCase();

/** Parse user-entered market rate (no scientific notation in UI). */
export function parseMarketRateInput(raw: string): number {
  const s = String(raw || '').replace(/,/g, '').trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** Format rate for display — never scientific notation. */
export function formatMarketRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const abs = Math.abs(value);
  let decimals = 6;
  if (abs >= 1000) decimals = 2;
  else if (abs >= 1) decimals = 6;
  else if (abs >= 0.01) decimals = 6;
  else decimals = 8;
  let s = value.toFixed(decimals);
  s = s.replace(/\.?0+$/, '');
  if (s.includes('e') || s.includes('E')) {
    s = value.toLocaleString('en-US', { maximumFractionDigits: decimals, useGrouping: false });
  }
  return s;
}

export function formatRateEquation(base: string, target: string, rate: number): string {
  const r = formatMarketRate(rate);
  if (!r) return '';
  return `1 ${base.trim().toUpperCase()} = ${r} ${target.trim().toUpperCase()}`;
}

/** How user enters rate: 1 base = X code, or 1 code = X base (stored always as base→code). */
export type RateInputSide = 'baseToCode' | 'codeToBase';

export function inverseMarketRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return 1 / rate;
}

export function storedRateFromInput(value: number, mode: RateInputSide): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return mode === 'baseToCode' ? value : inverseMarketRate(value);
}

export function inputValueFromStoredRate(storedRate: number, mode: RateInputSide): number {
  if (!Number.isFinite(storedRate) || storedRate <= 0) return 0;
  return mode === 'baseToCode' ? storedRate : inverseMarketRate(storedRate);
}

/** Pick the side that shows a more natural market number (usually ≥ 1). */
export function preferredRateInputMode(storedRate: number): RateInputSide {
  if (!Number.isFinite(storedRate) || storedRate <= 0) return 'baseToCode';
  return storedRate < 1 ? 'codeToBase' : 'baseToCode';
}

/** Stored rate: how many units of `code` equal 1 unit of shop base currency. */
export function baseRateFromShop(shop: MetaShop, code: string): number {
  const base = shopBaseCurrency(shop);
  const c = code.trim().toUpperCase();
  if (c === base) return 1;
  const entry = (shop.displayCurrencies || []).find(x => x.code.trim().toUpperCase() === c);
  return entry?.rate ?? 0;
}

/**
 * Cross rate: units of `to` per 1 unit of `from`.
 * rate(from, to) = rate(base, to) / rate(base, from)
 */
export function crossRate(shop: MetaShop, fromCode: string, toCode: string): number {
  const from = fromCode.trim().toUpperCase();
  const to = toCode.trim().toUpperCase();
  if (from === to) return 1;
  const rFrom = baseRateFromShop(shop, from);
  const rTo = baseRateFromShop(shop, to);
  if (rFrom <= 0 || rTo <= 0) return 0;
  return rTo / rFrom;
}

export function decimalPlacesForCurrency(code: string): number {
  const c = code.trim().toUpperCase();
  return c === 'IRR' || c === 'IRT' ? 0 : 2;
}

export function roundForCurrency(amount: number, code: string): number {
  const dp = decimalPlacesForCurrency(code);
  const f = 10 ** dp;
  return Math.round(amount * f) / f;
}

/** Convert amount between any two configured currencies. */
export function convertAmount(
  amount: number,
  fromCode: string,
  toCode: string,
  shop: MetaShop,
): number {
  const rate = crossRate(shop, fromCode, toCode);
  if (rate <= 0) return roundForCurrency(amount, toCode);
  return roundForCurrency(amount * rate, toCode);
}

export const convertFromBase = (amount: number, shop: MetaShop, targetCode: string): number =>
  convertAmount(amount, shopBaseCurrency(shop), targetCode, shop);

/** LTR isolate — keeps currency label visually left of the amount in RTL layouts. */
const LRI = '\u2066';
const PDI = '\u2069';

export type ShopAmountParts = { label: string; amount: string };

export const formatShopAmountParts = (
  amount: number,
  sourceCurrency: string,
  viewCurrency: string,
  shop: MetaShop,
  uiLang = 'fa',
): ShopAmountParts => {
  const base = shopBaseCurrency(shop);
  const src = (sourceCurrency || base).trim().toUpperCase();
  const view = (viewCurrency || base).trim().toUpperCase();
  const n = convertAmount(amount, src, view, shop);
  const decimals = decimalPlacesForCurrency(view);
  return {
    label: currencyDisplayLabel(shop, view, uiLang),
    amount: formatMetaShopNumber(n, decimals),
  };
};

export const formatShopAmount = (
  amount: number,
  sourceCurrency: string,
  viewCurrency: string,
  shop: MetaShop,
  uiLang = 'fa',
): string => {
  const { label, amount: num } = formatShopAmountParts(amount, sourceCurrency, viewCurrency, shop, uiLang);
  return `${LRI}${label} ${num}${PDI}`;
};

export const normalizeDisplayCurrencies = (
  baseCurrency: string,
  list: MetaShopDisplayCurrency[] | undefined,
): MetaShopDisplayCurrency[] => {
  const base = baseCurrency.trim().toUpperCase();
  const seen = new Set<string>();
  const out: MetaShopDisplayCurrency[] = [];
  for (const raw of list || []) {
    const code = raw.code?.trim().toUpperCase();
    if (!code || code === base || seen.has(code)) continue;
    const rate = Number(raw.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    seen.add(code);
    out.push({
      code,
      label: raw.label?.trim() || undefined,
      labelEn: raw.labelEn?.trim() || undefined,
      rate,
    });
  }
  return out;
};

export const shopDisplayCurrencies = (shop: MetaShop): MetaShopDisplayCurrency[] => {
  const base = shopBaseCurrency(shop);
  const extras = normalizeDisplayCurrencies(base, shop.displayCurrencies);
  return [
    {
      code: base,
      label: shop.currencyLabel?.trim() || currencyPresetLabel(base, 'fa'),
      labelEn: shop.currencyLabelEn?.trim() || currencyPresetLabel(base, 'en'),
      rate: 1,
    },
    ...extras,
  ];
};

export const currencyDisplayLabel = (shop: MetaShop, code: string, uiLang: string): string => {
  const c = code.trim().toUpperCase();
  const entry = shopDisplayCurrencies(shop).find(x => x.code.trim().toUpperCase() === c);
  if (entry) return displayCurrencyLabel(entry, uiLang);
  return c;
};

export type CrossRateRow = { from: string; to: string; rate: number; direct: boolean };

/** Pairwise rates for admin preview (all storefront currencies). */
export function buildCrossRatePreview(shop: MetaShop): CrossRateRow[] {
  const codes = shopDisplayCurrencies(shop).map(c => c.code.trim().toUpperCase());
  const base = shopBaseCurrency(shop);
  const rows: CrossRateRow[] = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      if (i === j) continue;
      const from = codes[i];
      const to = codes[j];
      const rate = crossRate(shop, from, to);
      if (rate <= 0) continue;
      const direct = from === base || to === base;
      rows.push({ from, to, rate, direct });
    }
  }
  return rows.sort((a, b) => {
    if (a.direct !== b.direct) return a.direct ? -1 : 1;
    return a.from.localeCompare(b.from) || a.to.localeCompare(b.to);
  });
}

export const suggestDisplayCurrency = (base: string, code: string): MetaShopDisplayCurrency => {
  const b = base.trim().toUpperCase();
  const c = code.trim().toUpperCase();
  const rate = DEFAULT_RATES_FROM[b]?.[c] ?? 1;
  return {
    code: c,
    label: currencyPresetLabel(c, 'fa'),
    labelEn: currencyPresetLabel(c, 'en'),
    rate: c === b ? 1 : rate,
  };
};

export const resolveViewCurrency = (shop: MetaShop, fromUrl?: string | null): string => {
  const list = shopDisplayCurrencies(shop);
  const code = (fromUrl || '').trim().toUpperCase();
  if (code && list.some(c => c.code.trim().toUpperCase() === code)) return code;
  return shopDefaultViewCurrency(shop);
};

/** Storefront opening currency (URL ?cur= overrides). */
export function shopDefaultViewCurrency(shop: MetaShop): string {
  const base = shopBaseCurrency(shop);
  const codes = shopDisplayCurrencies(shop).map(c => c.code.trim().toUpperCase());
  const pref = (shop.defaultDisplayCurrency || '').trim().toUpperCase();
  if (pref && codes.includes(pref)) return pref;
  return base;
}

export function normalizeDefaultDisplayCurrency(
  baseCurrency: string,
  displayCurrencies: MetaShopDisplayCurrency[] | undefined,
  preferred?: string,
): string | undefined {
  const base = baseCurrency.trim().toUpperCase();
  const extras = normalizeDisplayCurrencies(base, displayCurrencies);
  const codes = [base, ...extras.map(c => c.code.trim().toUpperCase())];
  const pref = (preferred || '').trim().toUpperCase();
  if (!pref || !codes.includes(pref)) return undefined;
  if (pref === base) return undefined;
  return pref;
}

export const readViewCurrencyFromUrl = (shop: MetaShop): string => {
  try {
    return resolveViewCurrency(shop, new URLSearchParams(window.location.search).get('cur'));
  } catch {
    return shopBaseCurrency(shop);
  }
};

export const writeViewCurrencyToUrl = (code: string) => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('cur', code.trim().toUpperCase());
    history.replaceState(null, '', url.toString());
  } catch { /* ignore */ }
};

export const feeCurrency = (fee: { currency?: string }, shop: MetaShop): string =>
  (fee.currency || shop.currency || 'USD').trim().toUpperCase();

export const feeAmountInBase = (fee: { amount?: number; currency?: string }, shop: MetaShop): number => {
  const base = shopBaseCurrency(shop);
  const amount = fee.amount || 0;
  const cur = feeCurrency(fee, shop);
  if (cur === base || amount === 0) return amount;
  return convertAmount(amount, cur, base, shop);
};

export function presetFromShop(shop: MetaShop): MetaShopCurrencyPreset {
  const base = shopBaseCurrency(shop);
  return {
    displayCurrencies: normalizeDisplayCurrencies(base, shop.displayCurrencies),
    currencyLabel: shop.currencyLabel,
    currencyLabelEn: shop.currencyLabelEn,
    defaultDisplayCurrency: shop.defaultDisplayCurrency,
  };
}

export function applyCurrencyPresetToShop(shop: MetaShop, preset: MetaShopCurrencyPreset): MetaShop {
  const base = shopBaseCurrency(shop);
  const displayCurrencies = normalizeDisplayCurrencies(base, preset.displayCurrencies);
  return {
    ...shop,
    currencyLabel: preset.currencyLabel,
    currencyLabelEn: preset.currencyLabelEn,
    displayCurrencies,
    defaultDisplayCurrency: normalizeDefaultDisplayCurrency(base, displayCurrencies, preset.defaultDisplayCurrency),
  };
}

export function resolveCurrencyPresets(
  shops: MetaShop[],
  stored?: Record<string, MetaShopCurrencyPreset>,
): Record<string, MetaShopCurrencyPreset> {
  const bases = [...new Set(shops.map(s => shopBaseCurrency(s)))].sort();
  const out: Record<string, MetaShopCurrencyPreset> = { ...(stored || {}) };
  for (const base of bases) {
    if (out[base]?.displayCurrencies?.length) continue;
    const sample = shops.find(s => shopBaseCurrency(s) === base);
    if (sample) out[base] = presetFromShop(sample);
    else if (!out[base]) out[base] = { displayCurrencies: [] };
  }
  return out;
}
