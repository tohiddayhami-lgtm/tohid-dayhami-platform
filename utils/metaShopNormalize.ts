import type { MetaShop, MetaShopPage, MetaShopPageCard, MetaShopProduct, MetaShopLang } from '../types';
import { normalizeDisplayCurrencies } from './metaShopCurrency';

const SHOP_I18N_KEYS = [
  'title', 'subtitle', 'collectionText', 'searchPlaceholder', 'cartButtonText',
  'orderThankYouText', 'footerText', 'address', 'invoiceHintText', 'productsTabLabel',
] as const;

const stripSuffixFields = (obj: Record<string, unknown>, baseKeys: string[]) => {
  for (const key of baseKeys) {
    delete obj[`${key}Fa`];
    delete obj[`${key}Ar`];
    delete obj[`${key}En`];
  }
};

const normalizeOrigin = (origin: unknown) => {
  if (!origin || typeof origin !== 'object') return undefined;
  const o = origin as Record<string, string>;
  const name = o.nameFa || o.name || o.nameEn || '';
  return name ? { name: String(name), flagUrl: o.flagUrl } : undefined;
};

/** Keep only remote URLs — base64 blobs blow past Firestore's 1 MiB doc limit. */
const isStorableImageUrl = (url: unknown): url is string => {
  const s = String(url || '').trim();
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return false;
  return /^https?:\/\//i.test(s) || s.startsWith('//');
};

const normalizeImages = (images: unknown): string[] =>
  Array.isArray(images) ? images.filter(isStorableImageUrl).slice(0, 6) : [];

export const normalizeMetaShopProduct = (p: MetaShopProduct & Record<string, unknown>): MetaShopProduct => {
  const i18n = { ...(p.i18n || {}) };
  if (!i18n.fa) i18n.fa = {};
  if (!i18n.fa.name && (p.nameFa || p.name)) i18n.fa.name = String(p.nameFa || p.name);
  if (!i18n.fa.description && (p.descriptionFa || p.description)) i18n.fa.description = String(p.descriptionFa || p.description);
  if (!i18n.fa.group && (p.groupFa || p.group)) i18n.fa.group = String(p.groupFa || p.group);
  if (p.nameAr && !i18n.ar?.name) { i18n.ar = { ...(i18n.ar || {}), name: String(p.nameAr) }; }
  if (p.descriptionAr && !i18n.ar?.description) { i18n.ar = { ...(i18n.ar || {}), description: String(p.descriptionAr) }; }
  if (p.groupAr && !i18n.ar?.group) { i18n.ar = { ...(i18n.ar || {}), group: String(p.groupAr) }; }

  const price = Number(p.price) || 0;
  const packPrice = Number(p.packPrice) || 0;
  const basePrice = p.basePrice != null ? Number(p.basePrice) : undefined;
  const basePackPrice = p.basePackPrice != null ? Number(p.basePackPrice) : undefined;
  const out: MetaShopProduct = {
    id: String(p.id || `p-${Date.now()}`),
    name: String(p.name || p.nameFa || i18n.fa?.name || ''),
    group: p.group || p.groupFa || i18n.fa?.group || undefined,
    subcategory: p.subcategory || undefined,
    description: p.description || p.descriptionFa || i18n.fa?.description || undefined,
    sku: p.sku || undefined,
    images: normalizeImages(p.images),
    active: p.active !== false,
    featured: p.featured || undefined,
    outOfStock: p.outOfStock || undefined,
    hidePrice: p.hidePrice || undefined,
    hidePriceText: p.hidePriceText || undefined,
    currency: p.currency || undefined,
    price: price || undefined,
    basePrice: basePrice != null && !Number.isNaN(basePrice) ? basePrice : undefined,
    packPrice: packPrice && packPrice !== price ? packPrice : undefined,
    basePackPrice: basePackPrice != null && !Number.isNaN(basePackPrice) ? basePackPrice : undefined,
    pack: p.pack != null ? Number(p.pack) : undefined,
    unit: p.unit || undefined,
    priceUnit: p.priceUnit || undefined,
    moq: p.moq || undefined,
    stockLabel: p.stockLabel || p.stockLabelFa || undefined,
    videoUrl: p.videoUrl || undefined,
    promoLabel: p.promoLabel || undefined,
    showStrikethroughPrice: p.showStrikethroughPrice,
    imageFit: p.imageFit === 'contain' || p.imageFit === 'cover' ? p.imageFit : undefined,
    priceMarkupType: p.priceMarkupType === 'percent' || p.priceMarkupType === 'amount' ? p.priceMarkupType : undefined,
    priceMarkupValue: p.priceMarkupValue != null ? Number(p.priceMarkupValue) : undefined,
    discountType: p.discountType === 'percent' || p.discountType === 'amount' ? p.discountType : undefined,
    discountValue: p.discountValue != null ? Number(p.discountValue) : undefined,
    origin: normalizeOrigin(p.origin),
    i18n: Object.keys(i18n).length ? i18n : undefined,
    priceOptions: p.priceOptions?.length
      ? p.priceOptions.map(o => ({
          id: String(o.id),
          label: String(o.label || ''),
          labelEn: o.labelEn,
          price: Number(o.price) || 0,
          currency: o.currency,
          basePrice: o.basePrice != null ? Number(o.basePrice) : undefined,
        }))
      : undefined,
    priceTiers: p.priceTiers?.length
      ? p.priceTiers.slice(0, 3).map(t => ({
          id: String(t.id),
          label: String(t.label || ''),
          labelEn: t.labelEn,
          price: Number(t.price) || 0,
          currency: t.currency,
          basePrice: t.basePrice != null ? Number(t.basePrice) : undefined,
          unitsInPack: t.unitsInPack != null ? Number(t.unitsInPack) : undefined,
        }))
      : undefined,
    realEstate: p.realEstate,
    searchKeywords: p.searchKeywords,
  };
  return out;
};

const normalizeCategory = (c: unknown): string | { fa?: string; en?: string; ar?: string } => {
  if (typeof c === 'string') return c;
  if (!c || typeof c !== 'object') return '';
  const o = c as Record<string, unknown>;
  const i18n = o.i18n as Record<string, Record<string, string>> | undefined;
  const fa = String(o.label || o.name || o.labelFa || o.nameFa || i18n?.fa?.label || i18n?.fa?.name || '').trim();
  const en = String(o.labelEn || o.nameEn || i18n?.en?.label || i18n?.en?.name || '').trim();
  const ar = String(o.labelAr || o.nameAr || i18n?.ar?.label || i18n?.ar?.name || '').trim();
  if (en || ar) return { fa: fa || en || ar, en: en || undefined, ar: ar || undefined };
  return fa;
};

const normalizePageCard = (c: MetaShopPageCard & Record<string, unknown>): MetaShopPageCard => {
  const i18n = { ...(c.i18n || {}) };
  if (!i18n.fa?.name && (c.name || c.nameFa)) i18n.fa = { ...(i18n.fa || {}), name: String(c.nameFa || c.name) };
  if (!i18n.fa?.desc && (c.desc || c.descFa)) i18n.fa = { ...(i18n.fa || {}), desc: String(c.descFa || c.desc) };
  const image = isStorableImageUrl(c.image) ? c.image : undefined;
  return {
    id: String(c.id || `c-${Date.now()}`),
    image,
    name: String(c.name || c.nameFa || i18n.fa?.name || ''),
    desc: c.desc || c.descFa || i18n.fa?.desc || undefined,
    i18n: Object.keys(i18n).length ? i18n : undefined,
  };
};

const normalizePage = (pg: MetaShopPage & Record<string, unknown>): MetaShopPage => {
  const i18n = { ...(pg.i18n || {}) };
  if (!i18n.fa?.label && (pg.label || pg.labelFa)) i18n.fa = { ...(i18n.fa || {}), label: String(pg.labelFa || pg.label) };
  if (!i18n.fa?.body && (pg.body || pg.bodyFa)) i18n.fa = { ...(i18n.fa || {}), body: String(pg.bodyFa || pg.body) };
  if (!i18n.fa?.description && (pg.description || pg.descriptionFa)) i18n.fa = { ...(i18n.fa || {}), description: String(pg.descriptionFa || pg.description) };
  return {
    id: String(pg.id || `pg-${Date.now()}`),
    label: String(pg.label || pg.labelFa || i18n.fa?.label || 'Page'),
    labelEn: pg.labelEn || i18n.en?.label || undefined,
    type: pg.type || 'text',
    body: pg.body || pg.bodyFa || i18n.fa?.body || undefined,
    bodyEn: pg.bodyEn || i18n.en?.body || undefined,
    description: pg.description || pg.descriptionFa || undefined,
    descriptionEn: pg.descriptionEn || i18n.en?.description || undefined,
    images: Array.isArray(pg.images) ? pg.images.filter(isStorableImageUrl).slice(0, 12) : undefined,
    cards: pg.cards?.map(c => normalizePageCard(c as MetaShopPageCard & Record<string, unknown>)),
    i18n: Object.keys(i18n).length ? i18n : undefined,
  };
};

const normalizeLang = (l: MetaShopLang & Record<string, unknown>): MetaShopLang => ({
  code: String(l.code || '').trim(),
  name: String(l.name || l.label || l.code || '').trim(),
  rtl: l.rtl ?? (l.dir === 'rtl'),
});

/** Strip import bloat and fit large shops under Firestore's ~1MB doc limit. */
export const normalizeMetaShopForCloud = (raw: MetaShop & Record<string, unknown>): MetaShop => {
  const i18n: Record<string, Record<string, string>> = { ...(raw.i18n || {}) };

  for (const key of SHOP_I18N_KEYS) {
    const faVal = raw[`${key}Fa`] as string | undefined;
    const arVal = raw[`${key}Ar`] as string | undefined;
    const enVal = raw[`${key}En`] as string | undefined;
    if (faVal) { i18n.fa = { ...(i18n.fa || {}), [key]: faVal }; }
    if (arVal) { i18n.ar = { ...(i18n.ar || {}), [key]: arVal }; }
    if (enVal) { i18n.en = { ...(i18n.en || {}), [key]: enVal }; }
  }

  const shop: MetaShop & Record<string, unknown> = {
    id: String(raw.id || `shop-${Date.now()}`),
    slug: String(raw.slug || '').trim() || 'shop',
    name: String(raw.name || 'Shop'),
    type: raw.type === 'services' || raw.type === 'realestate' ? raw.type : 'products',
    isActive: raw.isActive !== false,
    theme: raw.theme || { primary: '#2d4a1a', cover: '#2d4a1a', coverText: '#fdfbf6', bg: '#fdfbf6', heading: '#1f2a18', text: '#2d3a24' },
    currency: String(raw.currency || 'OMR').trim().toUpperCase(),
    defaultLang: raw.defaultLang || 'fa',
    languages: Array.isArray(raw.languages) ? raw.languages.map(l => normalizeLang(l as MetaShopLang & Record<string, unknown>)).filter(l => l.code) : undefined,
    i18n: Object.keys(i18n).length ? i18n : undefined,
    code: raw.code ? String(raw.code).trim().toUpperCase().slice(0, 4) : undefined,
    title: raw.title || raw.titleFa || i18n.fa?.title || undefined,
    subtitle: raw.subtitle || raw.subtitleFa || i18n.fa?.subtitle || undefined,
    collectionText: raw.collectionText || raw.collectionTextFa || i18n.fa?.collectionText || undefined,
    coverImage: isStorableImageUrl(raw.coverImage) ? raw.coverImage : undefined,
    logo: isStorableImageUrl(raw.logo) ? raw.logo : undefined,
    phone: raw.phone || undefined,
    whatsapp: raw.whatsapp || undefined,
    email: raw.email || undefined,
    website: raw.website || undefined,
    address: raw.address || raw.addressFa || i18n.fa?.address || undefined,
    footerText: raw.footerText || raw.footerTextFa || i18n.fa?.footerText || undefined,
    searchPlaceholder: raw.searchPlaceholder || raw.searchPlaceholderFa || undefined,
    cartButtonText: raw.cartButtonText || raw.cartButtonTextFa || undefined,
    orderThankYouText: raw.orderThankYouText || raw.orderThankYouTextFa || undefined,
    invoiceHintText: raw.invoiceHintText || i18n.fa?.invoiceHintText || undefined,
    showInvoiceHint: raw.showInvoiceHint,
    productsTabLabel: raw.productsTabLabel || raw.productsTabLabelFa || i18n.fa?.productsTabLabel || undefined,
    productsTabLabelEn: raw.productsTabLabelEn || i18n.en?.productsTabLabel || undefined,
    displayCurrencies: (() => {
      const base = String(raw.currency || 'OMR').trim().toUpperCase();
      const list = normalizeDisplayCurrencies(base, raw.displayCurrencies);
      return list.length ? list : undefined;
    })(),
    extraFees: raw.extraFees?.length ? raw.extraFees : undefined,
    discounts: raw.discounts?.length ? raw.discounts : undefined,
    taxRate: raw.taxRate || undefined,
    taxInclusive: raw.taxInclusive,
    taxLabel: raw.taxLabel,
    taxLabelEn: raw.taxLabelEn,
    hidePrices: raw.hidePrices,
    hidePriceText: raw.hidePriceText,
    priceMarkupType: raw.priceMarkupType === 'percent' || raw.priceMarkupType === 'amount' ? raw.priceMarkupType : undefined,
    priceMarkupValue: raw.priceMarkupValue != null ? Number(raw.priceMarkupValue) : undefined,
    showStrikethroughPrice: raw.showStrikethroughPrice,
    productImageFit: raw.productImageFit === 'contain' ? 'contain' : raw.productImageFit === 'cover' ? 'cover' : undefined,
    groupI18n: raw.groupI18n && typeof raw.groupI18n === 'object' ? raw.groupI18n : undefined,
    supplierCollaborationEnabled: raw.supplierCollaborationEnabled,
    floatingStickers: raw.floatingStickers?.length
      ? raw.floatingStickers
          .map(s => ({
            ...s,
            imageUrl: isStorableImageUrl(s.imageUrl) ? s.imageUrl : '',
          }))
          .filter(s => s.imageUrl)
      : undefined,
    seoTitle: raw.seoTitle,
    seoDescription: raw.seoDescription,
    seoImage: isStorableImageUrl(raw.seoImage) ? raw.seoImage : (isStorableImageUrl(raw.coverImage) ? raw.coverImage : undefined),
    directoryCats: raw.directoryCats,
    directoryCategories: raw.directoryCategories,
    directoryCategory: raw.directoryCategory,
    directorySub: raw.directorySub,
    directorySubcategory: raw.directorySubcategory,
    assignType: raw.assignType,
    assignedPersonnelIds: raw.assignedPersonnelIds,
    assignedDepartmentId: raw.assignedDepartmentId,
    editorPersonnelIds: raw.editorPersonnelIds,
    storefrontTagline: raw.storefrontTagline,
    storefrontTaglineEn: raw.storefrontTaglineEn,
    storefrontColor: raw.storefrontColor,
    createdAt: raw.createdAt || new Date().toISOString(),
    categories: Array.isArray(raw.categories)
      ? raw.categories.map(normalizeCategory).filter(c => (typeof c === 'string' ? c : c.fa || c.en))
      : undefined,
    pages: Array.isArray(raw.pages) ? raw.pages.map(p => normalizePage(p as MetaShopPage & Record<string, unknown>)) : undefined,
    products: Array.isArray(raw.products)
      ? raw.products.map(p => normalizeMetaShopProduct(p as MetaShopProduct & Record<string, unknown>))
      : [],
  };

  stripSuffixFields(shop, [...SHOP_I18N_KEYS]);
  delete shop.source;
  delete shop.shipping;
  delete shop.rtl;
  delete shop.tabs;
  delete shop.groupLabels;

  return shop as MetaShop;
};

export const metaShopPayloadBytes = (shop: MetaShop): number =>
  new TextEncoder().encode(JSON.stringify(shop)).length;

export const META_SHOP_FIRESTORE_MAX_BYTES = 1_048_576;
