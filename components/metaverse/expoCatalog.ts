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
    labelFa: 'دفاتر تجاری',
    labelEn: 'Commercial offices',
    emoji: '🏢',
    accent: '#0d9488',
    bg: '#f0fdfa',
    descFa: 'دفاتر شیشه‌ای دو طرف راهرو — از بغل دیده می‌شوند',
    descEn: 'Glass offices flanking the walkway — seen from the side',
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
  if (filter === 'storefront') {
    list = list.filter(b => resolveExpoStyle(b) === 'storefront' || resolveExpoStyle(b) === 'business_center');
  } else if (filter !== 'all') {
    list = list.filter(b => resolveExpoStyle(b) === filter);
  }
  return list;
};

export const blankExpoForStyle = (style: ExpoVisualStyle): MetaverseExpo => ({
  enabled: true,
  visualStyle: style === 'business_center' ? 'storefront' : style,
  preset: 'warehouse' as EnvPreset,
  width: style === 'storefront' || style === 'business_center' ? 24 : 30,
  depth: style === 'storefront' || style === 'business_center' ? 28 : 30,
  height: 9,
  groundColor: '#cfd4dc',
  wallColor: '#e9edf3',
  spawn: { x: 0, y: 0, z: style === 'storefront' || style === 'business_center' ? 11 : 8 },
  booths: [],
  schemaVersion: 1,
  entranceEnabled: true,
});
