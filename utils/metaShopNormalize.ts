import type { MetaShop, MetaShopPage, MetaShopPageCard, MetaShopProduct, MetaShopLang } from '../types';
import { normalizeDisplayCurrencies, normalizeDefaultDisplayCurrency } from './metaShopCurrency';
import { normalizeImageUrl, resolveProductImages } from './metaShopImage';
import { normalizeIncoterms } from './metaShopExportTerms';

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

/** Merge flat `fieldFa` / `fieldAr` / `fieldEn` into i18n (import JSON compatibility). */
const mergeRecordI18nSuffixes = (
  i18n: Record<string, Record<string, string>>,
  raw: Record<string, unknown>,
  fields: readonly string[],
): Record<string, Record<string, string>> => {
  const out: Record<string, Record<string, string>> = { ...i18n };
  for (const field of fields) {
    for (const [lang, suffix] of [['fa', 'Fa'], ['ar', 'Ar'], ['en', 'En']] as const) {
      const val = raw[`${field}${suffix}`] as string | undefined;
      if (val?.trim()) {
        out[lang] = { ...(out[lang] || {}), [field]: val.trim() };
      }
    }
  }
  return out;
};

const PAGE_I18N_FIELDS = ['label', 'body', 'description'] as const;
const CARD_I18N_FIELDS = ['name', 'desc'] as const;

const tabToPageId = (tab: Record<string, unknown>): string => {
  const id = String(tab.id || '').trim();
  if (id.startsWith('tab-')) return id.replace(/^tab-/, 'pg-');
  if (id.startsWith('pg-')) return id;
  const key = String(tab.pageKey || tab.slug || '').trim();
  if (key) return `pg-${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`;
  return `pg-${Date.now()}`;
};

const PAGE_KEY_ALIASES: Record<string, string[]> = {
  aboutUs: ['pg-about', 'about'],
  about: ['pg-about', 'about'],
  gallery: ['pg-gallery', 'gallery'],
  contactUs: ['pg-contact', 'contact'],
  contact: ['pg-contact', 'contact'],
  certificates: ['pg-certificates', 'certificates'],
};

const pageMatchesTab = (pg: MetaShopPage, tab: Record<string, unknown>): boolean => {
  const tabId = tabToPageId(tab);
  const rawTabId = String(tab.id || '').trim();
  if (pg.id === tab.id || pg.id === tabId || pg.id === rawTabId.replace(/^tab-/, 'pg-')) return true;
  const key = String(tab.pageKey || '').trim();
  if (key) {
    const aliases = PAGE_KEY_ALIASES[key] || [];
    if (aliases.some(a => pg.id === a || pg.id.includes(a.replace(/^pg-/, '')))) return true;
    const normalized = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (pg.id === `pg-${key}` || pg.id === `pg-${normalized}`) return true;
  }
  const slug = String(tab.slug || '').trim();
  if (slug && (pg.id === `pg-${slug}` || pg.id.replace(/^pg-/, '').startsWith(slug.split('-')[0]))) return true;
  return false;
};

const SHOP_TAB_LABEL_TO_PAGE_IDS: Record<string, string[]> = {
  aboutUsTabLabel: ['pg-about', 'pg-about-us'],
  galleryTabLabel: ['pg-gallery', 'pg-photo-gallery'],
  contactUsTabLabel: ['pg-contact', 'pg-contact-us'],
  certificatesTabLabel: ['pg-certificates'],
};

const applyShopTabLabelsToPages = (
  raw: Record<string, unknown>,
  pages: MetaShopPage[],
): MetaShopPage[] => {
  if (!pages.length) return pages;
  return pages.map(pg => {
    for (const [key, ids] of Object.entries(SHOP_TAB_LABEL_TO_PAGE_IDS)) {
      if (!ids.some(id => pg.id === id || pg.id.startsWith(id))) continue;
      const labelI18n: Record<string, Record<string, string>> = { ...(pg.i18n || {}) };
      for (const lang of ['fa', 'ar', 'en'] as const) {
        const suffix = lang === 'fa' ? 'Fa' : lang === 'ar' ? 'Ar' : 'En';
        const val = (raw[`${key}${suffix}`] as string | undefined)?.trim();
        if (val) labelI18n[lang] = { ...(labelI18n[lang] || {}), label: val };
      }
      return { ...pg, i18n: labelI18n };
    }
    return pg;
  });
};

const applyProductsTabFromTabs = (
  raw: Record<string, unknown>,
  i18n: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> => {
  const tabs = raw.tabs;
  if (!Array.isArray(tabs)) return i18n;
  const pt = tabs.find((t: unknown) => {
    const x = t as Record<string, unknown>;
    return x?.type === 'products' || x?.pageKey === 'products';
  }) as Record<string, unknown> | undefined;
  if (!pt) return i18n;
  const out = { ...i18n };
  const merged = mergeRecordI18nSuffixes(out, pt, ['label']);
  for (const lang of ['fa', 'ar', 'en'] as const) {
    const label = merged[lang]?.label;
    if (label) {
      out[lang] = { ...(out[lang] || {}), productsTabLabel: label };
    }
  }
  return out;
};

const normalizeOrigin = (origin: unknown) => {
  if (!origin || typeof origin !== 'object') return undefined;
  const o = origin as Record<string, string>;
  const name = o.nameFa || o.name || o.nameEn || '';
  return name ? { name: String(name), flagUrl: o.flagUrl } : undefined;
};

/** Keep only remote URLs — base64 blobs blow past Firestore's 1 MiB doc limit. */
const isStorableImageUrl = (url: unknown): url is string => {
  const s = normalizeImageUrl(String(url || ''));
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return false;
  return /^https?:\/\//i.test(s);
};

const normalizeImages = (images: unknown, legacyImage?: unknown): string[] =>
  resolveProductImages({ images, image: legacyImage }).filter(isStorableImageUrl).slice(0, 6);

export const normalizeMetaShopProduct = (p: MetaShopProduct & Record<string, unknown>): MetaShopProduct => {
  const i18n = { ...(p.i18n || {}) };
  if (!i18n.fa) i18n.fa = {};
  if (!i18n.fa.name && (p.nameFa || p.name)) i18n.fa.name = String(p.nameFa || p.name);
  if (!i18n.fa.description && (p.descriptionFa || p.description)) i18n.fa.description = String(p.descriptionFa || p.description);
  if (!i18n.fa.group && (p.groupFa || p.group)) i18n.fa.group = String(p.groupFa || p.group);
  if (p.nameAr && !i18n.ar?.name) { i18n.ar = { ...(i18n.ar || {}), name: String(p.nameAr) }; }
  if (p.descriptionAr && !i18n.ar?.description) { i18n.ar = { ...(i18n.ar || {}), description: String(p.descriptionAr) }; }
  if (p.groupAr && !i18n.ar?.group) { i18n.ar = { ...(i18n.ar || {}), group: String(p.groupAr) }; }
  if (p.nameEn && !i18n.en?.name) { i18n.en = { ...(i18n.en || {}), name: String(p.nameEn) }; }
  if (p.descriptionEn && !i18n.en?.description) { i18n.en = { ...(i18n.en || {}), description: String(p.descriptionEn) }; }
  if (p.groupEn && !i18n.en?.group) { i18n.en = { ...(i18n.en || {}), group: String(p.groupEn) }; }

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
    images: normalizeImages(p.images, p.image),
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
    i18n: undefined,
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
    incoterms: normalizeIncoterms(p.incoterms).length ? normalizeIncoterms(p.incoterms) : undefined,
  };
  if (i18n.fa) {
    if (i18n.fa.name === out.name) delete i18n.fa.name;
    if (i18n.fa.description === out.description) delete i18n.fa.description;
    if (i18n.fa.group === out.group) delete i18n.fa.group;
    if (!Object.keys(i18n.fa).length) delete i18n.fa;
  }
  out.i18n = Object.keys(i18n).length ? i18n : undefined;
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
  const i18n = mergeRecordI18nSuffixes({ ...(c.i18n || {}) }, c, CARD_I18N_FIELDS);
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
  const i18n = mergeRecordI18nSuffixes({ ...(pg.i18n || {}) }, pg, PAGE_I18N_FIELDS);
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

/** Build / merge pages from native `pages[]` and optional `tabs[]` in import JSON. */
const importPagesFromJson = (raw: Record<string, unknown>): MetaShopPage[] | undefined => {
  let pages: MetaShopPage[] = Array.isArray(raw.pages)
    ? raw.pages.map(p => normalizePage(p as MetaShopPage & Record<string, unknown>))
    : [];

  const tabs = raw.tabs;
  if (Array.isArray(tabs) && tabs.length) {
    const orderOf = new Map<string, number>();
    for (const tab of tabs) {
      if (!tab || typeof tab !== 'object') continue;
      const t = tab as Record<string, unknown>;
      if (t.type === 'products' || t.pageKey === 'products') continue;
      const pid = tabToPageId(t);
      const idx = pages.findIndex(p => pageMatchesTab(p, t));
      const pageId = idx >= 0 ? pages[idx].id : pid;
      orderOf.set(pageId, Number(t.order) || orderOf.size + 10);
      const tabI18n = mergeRecordI18nSuffixes(
        (t.i18n as Record<string, Record<string, string>>) || {},
        t,
        ['label'],
      );
      if (idx < 0) {
        pages.push(normalizePage({
          id: pid,
          type: t.type === 'gallery' ? 'gallery' : 'text',
          label: t.labelFa || t.label,
          labelEn: t.labelEn,
          i18n: tabI18n,
          images: [],
        } as MetaShopPage & Record<string, unknown>));
      } else {
        const pg = pages[idx];
        pages[idx] = normalizePage({
          ...pg,
          i18n: mergeRecordI18nSuffixes(pg.i18n || {}, { ...pg, ...t }, PAGE_I18N_FIELDS),
        } as MetaShopPage & Record<string, unknown>);
      }
    }
    pages.sort((a, b) => (orderOf.get(a.id) ?? 999) - (orderOf.get(b.id) ?? 999));
  }

  pages = applyShopTabLabelsToPages(raw, pages);
  return pages.length ? pages : undefined;
};

const normalizeLang = (l: MetaShopLang & Record<string, unknown>): MetaShopLang => ({
  code: String(l.code || '').trim(),
  name: String(l.name || l.label || l.code || '').trim(),
  rtl: l.rtl ?? (l.dir === 'rtl'),
});

/** Strip import bloat and fit large shops under Firestore's ~1MB doc limit. */
export const normalizeMetaShopForCloud = (raw: MetaShop & Record<string, unknown>): MetaShop => {
  let i18n: Record<string, Record<string, string>> = { ...(raw.i18n || {}) };

  for (const key of SHOP_I18N_KEYS) {
    const faVal = raw[`${key}Fa`] as string | undefined;
    const arVal = raw[`${key}Ar`] as string | undefined;
    const enVal = raw[`${key}En`] as string | undefined;
    if (faVal) { i18n.fa = { ...(i18n.fa || {}), [key]: faVal }; }
    if (arVal) { i18n.ar = { ...(i18n.ar || {}), [key]: arVal }; }
    if (enVal) { i18n.en = { ...(i18n.en || {}), [key]: enVal }; }
  }
  i18n = applyProductsTabFromTabs(raw, i18n);

  const shop: MetaShop & Record<string, unknown> = {
    id: String(raw.id || `shop-${Date.now()}`),
    slug: String(raw.slug || '').trim() || 'shop',
    name: String(raw.name || 'Shop'),
    type: raw.type === 'services' || raw.type === 'realestate' ? raw.type : 'products',
    isActive: raw.isActive !== false,
    theme: raw.theme || { primary: '#2d4a1a', cover: '#2d4a1a', coverText: '#fdfbf6', bg: '#fdfbf6', heading: '#1f2a18', text: '#2d3a24' },
    currency: String(raw.currency || 'OMR').trim().toUpperCase(),
    currencyLabel: raw.currencyLabel ? String(raw.currencyLabel).trim() : undefined,
    currencyLabelEn: raw.currencyLabelEn ? String(raw.currencyLabelEn).trim() : undefined,
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
    defaultDisplayCurrency: (() => {
      const base = String(raw.currency || 'OMR').trim().toUpperCase();
      return normalizeDefaultDisplayCurrency(base, raw.displayCurrencies, raw.defaultDisplayCurrency);
    })(),
    extraFees: raw.extraFees?.length ? raw.extraFees : undefined,
    discounts: raw.discounts?.length ? raw.discounts : undefined,
    taxRate: raw.taxRate || undefined,
    taxEnabled: raw.taxEnabled === false ? false : raw.taxEnabled === true ? true : undefined,
    taxInclusive: raw.taxInclusive,
    taxLabel: raw.taxLabel,
    taxLabelEn: raw.taxLabelEn,
    hidePrices: raw.hidePrices,
    hidePriceText: raw.hidePriceText,
    priceMarkupType: raw.priceMarkupType === 'percent' || raw.priceMarkupType === 'amount' ? raw.priceMarkupType : undefined,
    priceMarkupValue: raw.priceMarkupValue != null ? Number(raw.priceMarkupValue) : undefined,
    showStrikethroughPrice: raw.showStrikethroughPrice,
    productImageFit: raw.productImageFit === 'contain' ? 'contain' : raw.productImageFit === 'cover' ? 'cover' : undefined,
    defaultIncoterms: normalizeIncoterms(raw.defaultIncoterms).length ? normalizeIncoterms(raw.defaultIncoterms) : undefined,
    defaultOrigin: normalizeOrigin(raw.defaultOrigin),
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
    pages: importPagesFromJson(raw),
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
