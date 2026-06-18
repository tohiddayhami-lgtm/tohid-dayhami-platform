import type { ExpoVisualStyle, MetaBazaar, MetaverseExpo, EnvPreset } from '../../types';

export type ExpoCatalogFilter = ExpoVisualStyle | 'all';

export interface ExpoStyleCatalogItem {
  id: ExpoCatalogFilter;
  labelFa: string;
  labelEn: string;
  emoji: string;
  accent: string;
  bg: string;
  descFa: string;
  descEn: string;
}

export const EXPO_STYLE_CATALOG: ExpoStyleCatalogItem[] = [
  {
    id: 'all',
    labelFa: 'همه نمایشگاه‌ها',
    labelEn: 'All exhibitions',
    emoji: '📋',
    accent: '#475569',
    bg: '#f8fafc',
    descFa: 'تمام نمایشگاه‌های متاورس فعال',
    descEn: 'All active metaverse exhibitions',
  },
  {
    id: 'exhibition',
    labelFa: 'نمایشگاهی کلاسیک',
    labelEn: 'Classic exhibition',
    emoji: '🏛️',
    accent: '#4f46e5',
    bg: '#eef2ff',
    descFa: 'سالن نمایشگاهی با غرفه‌های کلاسیک',
    descEn: 'Exhibition hall with classic booths',
  },
  {
    id: 'storefront',
    labelFa: 'مغازه‌های شیشه‌ای',
    labelEn: 'Glass storefronts',
    emoji: '🏪',
    accent: '#0d9488',
    bg: '#f0fdfa',
    descFa: 'خیابان مغازه با ویترین شیشه‌ای',
    descEn: 'Shop street with glass storefronts',
  },
  {
    id: 'supermarket',
    labelFa: 'مراکز خرید',
    labelEn: 'Shopping malls',
    emoji: '🛒',
    accent: '#16a34a',
    bg: '#f0fdf4',
    descFa: 'فروشگاه زنجیره‌ای با دسته‌بندی قفسه‌ها',
    descEn: 'Supermarket aisles and departments',
  },
  {
    id: 'business_center',
    labelFa: 'دفاتر تجاری',
    labelEn: 'Business centers',
    emoji: '🏢',
    accent: '#c2410c',
    bg: '#fff7ed',
    descFa: 'مرکز تجاری ۳ طبقه با پله و دفاتر',
    descEn: '3-floor business center with stairs',
  },
];

export const resolveExpoStyle = (bazaar: MetaBazaar): ExpoVisualStyle =>
  bazaar.expo?.visualStyle || 'exhibition';

export const expoStyleMeta = (style: ExpoVisualStyle | ExpoCatalogFilter) =>
  EXPO_STYLE_CATALOG.find(c => c.id === style) ?? EXPO_STYLE_CATALOG[1];

export const bazaarHasActiveExpo = (b: MetaBazaar) => b.expo?.enabled === true;

export const filterBazaarsByExpoStyle = (
  bazaars: MetaBazaar[],
  filter: ExpoCatalogFilter,
  activeOnly = true,
) => {
  let list = activeOnly ? bazaars.filter(bazaarHasActiveExpo) : bazaars;
  if (filter !== 'all') list = list.filter(b => resolveExpoStyle(b) === filter);
  return list;
};

export const blankExpoForStyle = (style: ExpoVisualStyle): MetaverseExpo => ({
  enabled: true,
  visualStyle: style,
  preset: (style === 'business_center' ? 'lobby' : 'warehouse') as EnvPreset,
  width: style === 'business_center' ? 28 : 30,
  depth: style === 'business_center' ? 24 : 30,
  height: style === 'business_center' ? 12 : 9,
  groundColor: '#cfd4dc',
  wallColor: '#e9edf3',
  spawn: { x: 0, y: 0, z: style === 'business_center' ? 7 : 8 },
  booths: [],
  schemaVersion: 1,
  entranceEnabled: style !== 'business_center',
});
