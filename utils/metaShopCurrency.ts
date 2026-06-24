import type { MetaShop, MetaShopDisplayCurrency } from '../types';
import { formatMetaShopNumber } from './metaShopLang';

const PRESET_LABELS: Record<string, { fa: string; en: string }> = {
  OMR: { fa: 'ریال عمان', en: 'Omani Rial' },
  USD: { fa: 'دلار آمریکا', en: 'US Dollar' },
  AED: { fa: 'درهم امارات', en: 'UAE Dirham' },
  IRR: { fa: 'ریال ایران', en: 'Iranian Rial' },
  EUR: { fa: 'یورو', en: 'Euro' },
  GBP: { fa: 'پوند انگلیس', en: 'British Pound' },
  SAR: { fa: 'ریال سعودی', en: 'Saudi Riyal' },
  QAR: { fa: 'ریال قطر', en: 'Qatari Riyal' },
  KWD: { fa: 'دینار کویت', en: 'Kuwaiti Dinar' },
  BHD: { fa: 'دینار بحرین', en: 'Bahraini Dinar' },
  CNY: { fa: 'یوآن چین', en: 'Chinese Yuan' },
};

/** Approximate rates: 1 unit of base → target (editable in admin). */
export const DEFAULT_RATES_FROM: Record<string, Record<string, number>> = {
  OMR: { USD: 2.597, AED: 9.54, IRR: 110000 },
  USD: { OMR: 0.385, AED: 3.67, IRR: 42000 },
  AED: { OMR: 0.105, USD: 0.272, IRR: 11500 },
  IRR: { OMR: 0.0000091, USD: 0.000024, AED: 0.000087 },
};

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

export const shopDisplayCurrencies = (shop: MetaShop): MetaShopDisplayCurrency[] => {
  const base = (shop.currency || 'USD').trim().toUpperCase();
  const extras = (shop.displayCurrencies || []).filter(c => c.code?.trim() && (c.rate ?? 0) > 0);
  const hasBase = extras.some(c => c.code.trim().toUpperCase() === base);
  const list: MetaShopDisplayCurrency[] = hasBase
    ? []
    : [{ code: base, label: currencyPresetLabel(base, 'fa'), labelEn: currencyPresetLabel(base, 'en'), rate: 1 }];
  extras.forEach(c => {
    const code = c.code.trim().toUpperCase();
    if (list.some(x => x.code.toUpperCase() === code)) return;
    list.push({ ...c, code, rate: c.rate });
  });
  return list;
};

const rateTo = (shop: MetaShop, targetCode: string): number => {
  const base = (shop.currency || 'USD').trim().toUpperCase();
  const target = targetCode.trim().toUpperCase();
  if (target === base) return 1;
  const entry = (shop.displayCurrencies || []).find(c => c.code.trim().toUpperCase() === target);
  return entry?.rate ?? 0;
};

export const convertFromBase = (amount: number, shop: MetaShop, targetCode: string): number => {
  const r = rateTo(shop, targetCode);
  if (r <= 0) return amount;
  const decimals = targetCode.toUpperCase() === 'IRR' ? 0 : 2;
  const n = amount * r;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export const formatShopAmount = (
  amount: number,
  sourceCurrency: string,
  viewCurrency: string,
  shop: MetaShop,
): string => {
  const base = (shop.currency || 'USD').trim().toUpperCase();
  const src = (sourceCurrency || base).trim().toUpperCase();
  const view = (viewCurrency || base).trim().toUpperCase();
  let n = amount;
  if (src === base && view !== base) n = convertFromBase(amount, shop, view);
  else if (src !== view) {
    const decimals = src === 'IRR' ? 0 : 2;
    const f = 10 ** decimals;
    n = Math.round(amount * f) / f;
    return `${src} ${formatMetaShopNumber(n, decimals)}`;
  }
  const decimals = view === 'IRR' ? 0 : 2;
  const f = 10 ** decimals;
  n = Math.round(n * f) / f;
  return `${view} ${formatMetaShopNumber(n, decimals)}`;
};

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

export const shopBaseCurrency = (shop: MetaShop): string =>
  (shop.currency || 'USD').trim().toUpperCase();

export const resolveViewCurrency = (shop: MetaShop, fromUrl?: string | null): string => {
  const base = shopBaseCurrency(shop);
  const list = shopDisplayCurrencies(shop);
  const code = (fromUrl || '').trim().toUpperCase();
  if (code && list.some(c => c.code.trim().toUpperCase() === code)) return code;
  return base;
};

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
  } catch {}
};
