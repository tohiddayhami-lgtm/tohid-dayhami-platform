import type { MetaShop, MetaShopLang } from '../types';

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
