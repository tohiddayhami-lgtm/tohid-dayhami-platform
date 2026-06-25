import type { MetaShop, MetaShopLang } from '../types';
import { textMatchesLang } from './metaShopCategories';

/** RTL language codes when `rtl` flag is not set on the shop language entry */
export const META_SHOP_RTL_CODES = ['fa', 'ar', 'he', 'ur', 'ps', 'ku', 'dv'];

export const DEFAULT_PRODUCT_LANGS: MetaShopLang[] = [
  { code: 'fa', name: 'فارسی', rtl: true },
  { code: 'en', name: 'English' },
];

export const DEFAULT_REALESTATE_LANGS: MetaShopLang[] = [
  { code: 'fa', name: 'فارسی', rtl: true },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'en', name: 'English' },
];

/** Languages configured on the shop; sensible defaults only when the list is empty */
export const resolveShopLanguages = (shop: Pick<MetaShop, 'languages' | 'type'>): MetaShopLang[] => {
  const configured = (shop.languages || []).filter(l => l.code?.trim());
  if (configured.length) return configured;
  return shop.type === 'realestate' ? DEFAULT_REALESTATE_LANGS : DEFAULT_PRODUCT_LANGS;
};

export const isRtlLang = (code: string, langs: MetaShopLang[]) => {
  const entry = langs.find(x => x.code === code);
  return entry ? !!entry.rtl : META_SHOP_RTL_CODES.includes(code);
};

export const localeForLang = (code: string): string => {
  const known: Record<string, string> = {
    fa: 'fa-IR', ar: 'ar', en: 'en-US', zh: 'zh-CN', tr: 'tr-TR', de: 'de-DE',
    fr: 'fr-FR', ru: 'ru-RU', es: 'es-ES', it: 'it-IT', hi: 'hi-IN', ur: 'ur-PK',
  };
  return known[code] || code;
};

/** Latin digits for prices and quantities on the Meta Shop storefront. */
export const META_SHOP_NUM_LOCALE = 'en-US';

export const formatMetaShopNumber = (n: number, maximumFractionDigits = 2): string =>
  n.toLocaleString(META_SHOP_NUM_LOCALE, { maximumFractionDigits, minimumFractionDigits: 0 });

/** Legacy fa/en fields on pages, fees, options, etc. */
export const legacyBilingual = (uiLang: string, faVal?: string, enVal?: string) => {
  if (uiLang === 'fa') return faVal || enVal || '';
  if (uiLang === 'en') return enVal || faVal || '';
  return enVal || faVal || '';
};

/** Per-item `i18n[lang][key]` with en → fa fallbacks for missing translations */
export const translateField = (
  i18n: Record<string, Record<string, string>> | undefined,
  key: string,
  legacy: string,
  uiLang: string,
) => {
  if (i18n?.[uiLang]?.[key]) return i18n[uiLang][key];
  if (uiLang !== 'en' && i18n?.en?.[key]) return i18n.en[key];
  if (uiLang !== 'fa' && uiLang !== 'en' && i18n?.fa?.[key]) return i18n.fa[key];
  if (uiLang === 'en') return legacyBilingual('en', legacy, '') || legacy;
  return legacy || '';
};

/** Built-in UI chrome: exact lang → en → fa */
export const uiString = (
  strings: Record<string, Record<string, string>>,
  uiLang: string,
  key: string,
) => strings[uiLang]?.[key] ?? strings.en?.[key] ?? strings.fa?.[key] ?? key;

const STOCK_LABELS: Record<string, Record<string, string>> = {
  in_stock: { fa: 'موجود', en: 'In stock', ar: 'متوفر', zh: '有货', tr: 'Stokta', de: 'Auf Lager', fr: 'En stock', ru: 'В наличии', es: 'En stock' },
  out_of_stock: { fa: 'ناموجود', en: 'Out of stock', ar: 'غير متوفر', zh: '缺货', tr: 'Stokta yok', de: 'Nicht vorrätig', fr: 'Rupture de stock', ru: 'Нет в наличии', es: 'Agotado' },
  low_stock: { fa: 'موجودی محدود', en: 'Low stock', ar: 'كمية محدودة', zh: '库存有限', tr: 'Az stok', de: 'Geringer Bestand', fr: 'Stock limité', ru: 'Мало на складе', es: 'Pocas unidades' },
  preorder: { fa: 'پیش‌سفارش', en: 'Pre-order', ar: 'طلب مسبق', zh: '预订', tr: 'Ön sipariş', de: 'Vorbestellung', fr: 'Précommande', ru: 'Предзаказ', es: 'Preventa' },
};

const STOCK_PHRASES: Record<string, string[]> = {
  in_stock: ['in stock', 'in-stock', 'instock', 'available', 'موجود', 'متوفر', '有货'],
  out_of_stock: ['out of stock', 'out-of-stock', 'outofstock', 'unavailable', 'sold out', 'ناموجود', 'غير متوفر', 'غيرمتوفر', '缺货'],
  low_stock: ['low stock', 'limited stock', 'موجودی محدود', 'كمية محدودة'],
  preorder: ['pre-order', 'preorder', 'pre order', 'پیش‌سفارش', 'پیش سفارش', 'طلب مسبق'],
};

const canonicalStockKey = (label: string): string | null => {
  const n = label.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const [key, phrases] of Object.entries(STOCK_PHRASES)) {
    if (phrases.some(p => p.toLowerCase().replace(/\s+/g, ' ') === n)) return key;
  }
  return null;
};

/** Product stock badge — i18n field, then known phrases, then script-appropriate legacy text */
export const translateStockLabel = (
  label: string | undefined,
  uiLang: string,
  i18n?: Record<string, Record<string, string>>,
): string => {
  if (!label?.trim()) return '';
  const fromI18n = translateField(i18n, 'stockLabel', '', uiLang);
  if (fromI18n?.trim()) return fromI18n;
  if (textMatchesLang(label, uiLang)) return label;
  const key = canonicalStockKey(label);
  if (key) {
    const map = STOCK_LABELS[key];
    return map[uiLang] ?? map.en ?? map.fa ?? label;
  }
  return label;
};
