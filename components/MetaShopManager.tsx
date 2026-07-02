import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MetaShop, MetaShopProduct, MetaShopOrder, MetaShopPropertyReferral, MetaShopSupplierCollaboration, MetaShopType, Personnel, AppConfig, Department, MetaShopEvent, CustomerAccount } from '../types';
import { referralToProduct, supplierCollaborationToProduct } from '../utils/metaShopReferral';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconCopy, IconLink, IconSearch, IconUsers, IconSettings, IconUpload, IconGlobe, IconTag } from './Icons';
import { subscribeToMetaShops, saveMetaShopToCloud, deleteMetaShopFromCloud, fetchMetaShopShellBySlug, enrichMetaShopShell, hydrateMetaShop, hydrateMetaShopProgressive, loadMetaShopProductsFull, recoverMetaShopFromChunks, recoverAllMetaShopsProducts, probeMetaShopProductsAvailable, uploadFileWithProgress, type MetaShopSaveOptions } from '../services/firebaseService';
import { shopNeedsProductHydration, isShellOnlyMetaShopJson } from '../utils/metaShopChunks';
import { downloadSample } from './metaShopSamples';
import { MetaBazaarManager } from './MetaBazaarManager';
import { MetaExpoManager } from './MetaExpoManager';
import { MetaShopFileUploader } from './MetaShopFileUploader';
import { MetaShopRealEstateFields } from './MetaShopRealEstateFields';
import { MetaShopFloatingPromosEditor } from './MetaShopFloatingPromosEditor';
import { defaultRealEstate } from '../utils/metaShopRealEstate';
import { DEFAULT_PRODUCT_LANGS, DEFAULT_REALESTATE_LANGS, isRtlLang } from '../utils/metaShopLang';
import { MetaBazaar } from '../types';
import { uniqueShopCode, shopCodeOf } from './shopCode';
import { parseSearchKeywords, formatSearchKeywordsForInput, textMatchesSearchQuery, shopMatchesSearch } from '../utils/metaShopSearch';
import { productHasPriceDrift, revertAllProductsToBase, revertProductToBase } from '../utils/metaShopPricing';
import { AppModal } from './AppModal';
import { normalizeDisplayCurrencies, normalizeDefaultDisplayCurrency } from '../utils/metaShopCurrency';
import { MetaShopCurrencyRatesEditor } from './MetaShopCurrencyRatesEditor';
import { normalizeMetaShopForCloud } from '../utils/metaShopNormalize';
import { metaFromMetaShop } from '../utils/pageMeta';
import { MetaShopOrderDetailCard } from './MetaShopOrderDetailCard';
import { MetaShopOrdersHub } from './MetaShopOrdersHub';
import { clearMetaShopManagerNav, loadMetaShopManagerNav, saveMetaShopManagerNav } from '../utils/metaShopPanelSession';
import { MetaShopBulkPriceMarkupPanel, MetaShopProductMarkupFields, MetaShopProductPromoLabelField } from './MetaShopPriceMarkupEditor';
import { MetaShopBulkExportTermsPanel, MetaShopProductExportFields } from './MetaShopExportTermsEditor';
import { MetaShopPriceHistoryPanel } from './MetaShopPriceHistoryPanel';
import {
  appendPriceHistory,
  appendPriceHistoryMany,
  cloneProductsBaseline,
  detectManualPriceEdits,
  type PriceHistoryAction,
} from '../utils/metaShopPriceHistory';
import { MetaShopProductPriceTiersEditor } from './MetaShopProductPriceTiersEditor';
import { MetaShopBackupPanel } from './MetaShopBackupPanel';
import { Language } from '../App';
import { normalizeImageUrl, metaShopProductImageUrl } from '../utils/metaShopImage';

const EDITOR_PRODUCT_PAGE_SIZE = 25;

interface Props {
  metaShops: MetaShop[];
  metaShopOrders: MetaShopOrder[];
  metaShopReferrals?: MetaShopPropertyReferral[];
  metaShopSupplierCollaborations?: MetaShopSupplierCollaboration[];
  personnel: Personnel[];
  config: AppConfig;
  lang: Language;
  shopBaseUrl: string;
  onSaveMetaShop: (shop: MetaShop, opts?: MetaShopSaveOptions) => Promise<void>;
  onDeleteMetaShop: (id: string) => Promise<void>;
  onUpdateMetaShopOrder: (id: string, updates: Partial<MetaShopOrder>) => Promise<void>;
  onDeleteMetaShopOrder?: (id: string) => Promise<void>;
  onRestoreMetaShopOrder?: (id: string) => Promise<void>;
  onUpdateMetaShopPropertyReferral?: (id: string, updates: Partial<MetaShopPropertyReferral>) => Promise<void>;
  onUpdateMetaShopSupplierCollaboration?: (id: string, updates: Partial<MetaShopSupplierCollaboration>) => Promise<void>;
  metaBazaars?: MetaBazaar[];
  onSaveMetaBazaar?: (b: MetaBazaar) => Promise<void>;
  onDeleteMetaBazaar?: (id: string) => Promise<void>;
  customerAccounts?: CustomerAccount[];
  readonly?: boolean;
  canDelete?: boolean;
  canDeleteBooths?: boolean;
  /** When true (master), show a global all-orders view across every shop. */
  showAllOrders?: boolean;
  /** Display name for backup audit (master). */
  backupActorName?: string;
}

const DEFAULT_THEME = { primary: '#2d4a1a', cover: '#2d4a1a', coverText: '#fdfbf6', bg: '#fdfbf6', heading: '#1f2a18', text: '#2d3a24' };

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `shop-${Date.now().toString(36)}`;

const blankShop = (): MetaShop => ({
  id: `shop-${Date.now()}`, slug: '', name: '', type: 'products', isActive: true,
  theme: { ...DEFAULT_THEME }, currency: 'USD', products: [], createdAt: new Date().toISOString(),
  collectionText: '', title: '', subtitle: '', cartButtonText: '', orderThankYouText: '',
});

// Tolerant importer: accepts our MetaShop JSON OR a catalog-project JSON (data.products[]).
const importFromJson = (raw: string, base: MetaShop): MetaShop => {
  const json = JSON.parse(raw);
  // Native MetaShop format (top-level products[]) — import everything, normalize products.
  if (json.products && Array.isArray(json.products)) {
    const { _aiGuide, _instructions, products: rawProducts, ...clean } = json;
    // Shell-only export (products live in metaShopChunks) — merge metadata without wiping products.
    if (isShellOnlyMetaShopJson(json) && (base.products?.length || base.productCount || base.productChunkCount)) {
      const {
        products: _dropProducts,
        productCount: _dropCount,
        productChunkCount: _dropChunks,
        productRefs: _dropRefs,
        extrasOffloaded: _dropExtras,
        productRefChunkCount: _dropRefChunks,
        ...metaOnly
      } = clean as Record<string, unknown>;
      return normalizeMetaShopForCloud({
        ...base,
        ...metaOnly,
        id: base.id,
        createdAt: base.createdAt,
        products: base.products || [],
        productCount: base.productCount ?? (Number(json.productCount) || 0),
        productChunkCount: base.productChunkCount ?? (Number(json.productChunkCount) || 0),
        extrasOffloaded: base.extrasOffloaded ?? json.extrasOffloaded,
      } as MetaShop);
    }
    const products = rawProducts.map((p: any, i: number) => ({
      ...p,
      id: p.id || `p-${Date.now()}-${i}`,
      images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
      active: p.active !== false,
    }));
    return normalizeMetaShopForCloud({
      ...base, ...clean,
      id: base.id, createdAt: base.createdAt,
      theme: { ...DEFAULT_THEME, ...(json.theme || {}) },
      type: (['services', 'realestate'].includes(json.type) ? json.type : 'products') as MetaShopType,
      products,
    } as MetaShop);
  }
  const data = json.data || json;
  const cc = data.catalogConfig || {};
  const cfg = data.config || {};
  const currency = cfg.outputCurrency || base.currency || 'USD';
  const products: MetaShopProduct[] = (data.products || []).filter((p: any) => p.active !== false).map((p: any, i: number) => {
    const price = Number(p.unitPrice) || 0;
    const itemsPerPack = Number(p.itemsPerPack) || 0;
    const packPrice = Number(p.packPrice) || (itemsPerPack && price ? +(price * itemsPerPack).toFixed(2) : 0);
    return {
      id: `p-${Date.now()}-${i}`,
      name: p.name || `Product ${i + 1}`,
      sku: p.sku || '', hsCode: p.hsCode || '',
      group: p.group || '', subcategory: p.subcategory || '',
      description: p.catalogDescription || p.description || '',
      images: Array.isArray(p.gallery) ? p.gallery.filter((g: any) => typeof g === 'string') : [],
      active: p.active !== false,
      currency: p.currency || currency,
      price, packPrice,
      unit: p.measurementUnit || p.unit || '',
      pack: itemsPerPack || undefined,
      moq: p.catalogMOQ || '',
      stockLabel: p.stockLabel || '',
      colors: Array.isArray(p.availableColors) ? p.availableColors.map((c: any) => ({ name: c.name, hex: c.hex, hex2: c.hex2 })) : undefined,
      origin: p.origin ? { name: p.origin.name, flagUrl: p.origin.flagUrl } : undefined,
    } as MetaShopProduct;
  });
  return {
    ...base,
    name: base.name || cc.title || 'Shop',
    title: cc.title || base.title,
    subtitle: cc.subtitle || base.subtitle,
    collectionText: cc.collectionText || base.collectionText,
    coverImage: cc.coverImage || base.coverImage,
    logo: cc.logoImage || base.logo,
    currency,
    phone: cc.contactPhone || base.phone,
    whatsapp: cc.contactWhatsapp || cc.whatsapp || base.whatsapp,
    email: cc.contactEmail || base.email,
    website: cc.website || base.website,
    address: cc.contactAddress || base.address,
    footerText: cc.footerText || base.footerText,
    theme: {
      ...base.theme,
      primary: cc.primaryColor || cc.coverColor || base.theme.primary,
      cover: cc.coverColor || cc.primaryColor || base.theme.cover,
      coverText: cc.coverTextColor || base.theme.coverText,
      bg: cc.backgroundColor || base.theme.bg,
      heading: cc.headingColor || base.theme.heading,
      text: cc.textColor || base.theme.text,
    },
    products,
    pages: buildPagesFromCatalog(cc),
  };
};

// Map a catalog-project catalogConfig into MetaShop pages (About / Gallery / custom pages)
const buildPagesFromCatalog = (cc: any): import('../types').MetaShopPage[] => {
  const out: import('../types').MetaShopPage[] = [];
  if (cc.aboutUsText) out.push({ id: `pg-${Date.now()}-a`, label: cc.aboutUsTabLabel || 'About Us', labelEn: 'About Us', type: 'text', body: cc.aboutUsText, images: Array.isArray(cc.aboutUsImages) ? cc.aboutUsImages.filter((x: any) => typeof x === 'string') : [] });
  if (Array.isArray(cc.companyPhotos) && cc.companyPhotos.length) out.push({ id: `pg-${Date.now()}-g`, label: 'Company Gallery', labelEn: 'Company Gallery', type: 'gallery', images: cc.companyPhotos.filter((x: any) => typeof x === 'string') });
  const customs = [...(Array.isArray(cc.customPages) ? cc.customPages : []), ...(Array.isArray(cc.sections) ? cc.sections : [])];
  customs.forEach((p: any, i: number) => {
    if (!p) return;
    const items = p.items || p.cards;
    if (Array.isArray(items) && items.length) {
      out.push({ id: `pg-${Date.now()}-c${i}`, label: p.title || 'Page', type: 'cards', description: p.content || p.description || '', cards: items.map((it: any, j: number) => ({ id: `c-${Date.now()}-${i}-${j}`, image: it.image || it.logo || it.img, name: it.name || it.title, desc: it.desc || it.description })) });
    } else {
      out.push({ id: `pg-${Date.now()}-t${i}`, label: p.title || 'Page', type: 'text', body: p.content || p.description || '', images: Array.isArray(p.images) ? p.images.filter((x: any) => typeof x === 'string') : [] });
    }
  });
  return out;
};

export const MetaShopManager: React.FC<Props> = ({ metaShops, metaShopOrders, metaShopReferrals = [], metaShopSupplierCollaborations = [], personnel, config, lang, shopBaseUrl, onSaveMetaShop, onDeleteMetaShop, onUpdateMetaShopOrder, onDeleteMetaShopOrder, onRestoreMetaShopOrder, onUpdateMetaShopPropertyReferral, onUpdateMetaShopSupplierCollaboration, metaBazaars = [], onSaveMetaBazaar, onDeleteMetaBazaar, customerAccounts = [], readonly = false, canDelete = false, canDeleteBooths = false, showAllOrders = false, backupActorName = 'Master' }) => {
  const savedNav = loadMetaShopManagerNav();
  const [section, setSection] = useState<'shops' | 'bazaars' | 'expos' | 'uploads'>('shops');
  const [shopFilter, setShopFilter] = useState<'all' | MetaShopType>('all');
  const [mode, setMode] = useState<'list' | 'editor' | 'orders' | 'all-orders' | 'referrals' | 'supplier-collab' | 'analytics' | 'keywords'>(() => {
    if (savedNav?.mode === 'orders' || savedNav?.mode === 'all-orders') return savedNav.mode;
    return 'list';
  });
  const [draft, setDraft] = useState<MetaShop | null>(null);
  const [keywordEdits, setKeywordEdits] = useState<Record<string, string>>({});
  const [keywordSearch, setKeywordSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [keywordSaving, setKeywordSaving] = useState(false);
  const [ordersShopId, setOrdersShopId] = useState<string | null>(() => (
    savedNav?.mode === 'orders' ? (savedNav.ordersShopId ?? null) : null
  ));
  const [referralsShopId, setReferralsShopId] = useState<string | null>(null);
  const [supplierCollabShopId, setSupplierCollabShopId] = useState<string | null>(null);
  const [analyticsShopId, setAnalyticsShopId] = useState<string | null>(null);
  const [analyticsEvents, setAnalyticsEvents] = useState<MetaShopEvent[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [embedShop, setEmbedShop] = useState<MetaShop | null>(null); // Google Site / iframe embed export modal
  const [embedHeight, setEmbedHeight] = useState(1200);
  const [saving, setSaving] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsSyncing, setProductsSyncing] = useState(false);
  const [productsFullyLoaded, setProductsFullyLoaded] = useState(false);
  const [productsLoadFailed, setProductsLoadFailed] = useState(false);
  const [recoveringShopId, setRecoveringShopId] = useState<string | null>(null);
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);
  const [bulkRecovering, setBulkRecovering] = useState(false);
  const [productProbe, setProductProbe] = useState<Record<string, 'pending' | 'ok' | 'missing'>>({});
  const [editorProductShown, setEditorProductShown] = useState(EDITOR_PRODUCT_PAGE_SIZE);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const seoImageInputRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);
  const priceBaselineRef = useRef<MetaShopProduct[] | null>(null);
  const priceBaselineShopIdRef = useRef<string | null>(null);
  const [updateShop, setUpdateShop] = useState<MetaShop | null>(null);
  const [dirCatFa, setDirCatFa] = useState('');
  const [dirCatEn, setDirCatEn] = useState('');
  const [transOpen, setTransOpen] = useState<Record<string, boolean>>({});
  const [pageTransOpen, setPageTransOpen] = useState<Record<string, boolean>>({});
  const [cardTransOpen, setCardTransOpen] = useState<Record<string, boolean>>({});
  const T = lang === 'fa';
  const departments: Department[] = config.departments || [];

  useEffect(() => {
    if (mode === 'orders' || mode === 'all-orders') {
      saveMetaShopManagerNav({ mode, ordersShopId: mode === 'orders' ? ordersShopId : null });
    } else {
      clearMetaShopManagerNav();
    }
  }, [mode, ordersShopId]);

  useEffect(() => {
    if (mode !== 'orders' || !ordersShopId) return;
    if (!metaShops.some(s => s.id === ordersShopId)) {
      setMode('list');
      setOrdersShopId(null);
    }
  }, [metaShops, mode, ordersShopId]);

  // Detect shops whose shell says N products but chunks/backups are missing on the server.
  useEffect(() => {
    if (section !== 'shops' || mode !== 'list') return;
    const targets = metaShops.filter(s => (s.productCount ?? 0) > 0);
    if (!targets.length) return;
    let cancelled = false;
    const next: Record<string, 'pending' | 'ok' | 'missing'> = {};
    targets.forEach(s => { next[s.id] = 'pending'; });
    setProductProbe(prev => ({ ...prev, ...next }));
    (async () => {
      for (const s of targets) {
        if (cancelled) return;
        try {
          const ok = await probeMetaShopProductsAvailable(s);
          if (cancelled) return;
          setProductProbe(prev => ({ ...prev, [s.id]: ok ? 'ok' : 'missing' }));
        } catch {
          if (!cancelled) setProductProbe(prev => ({ ...prev, [s.id]: 'missing' }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [metaShops, section, mode]);

  const backToList = () => {
    clearMetaShopManagerNav();
    setMode('list');
    setOrdersShopId(null);
  };

  const startKeywordsBulk = () => {
    const map: Record<string, string> = {};
    metaShops.forEach(s => { map[s.id] = formatSearchKeywordsForInput(s.searchKeywords); });
    setKeywordEdits(map);
    setKeywordSearch('');
    setMode('keywords');
  };

  const saveKeywordsBulk = async () => {
    if (readonly) return;
    setKeywordSaving(true);
    try {
      const tasks = metaShops.map(async shop => {
        const raw = keywordEdits[shop.id] ?? '';
        const next = parseSearchKeywords(raw);
        const prev = shop.searchKeywords || [];
        if (next.join('|') === prev.join('|')) return;
        await onSaveMetaShop({ ...shop, searchKeywords: next.length ? next : undefined });
      });
      await Promise.all(tasks);
      alert(T ? 'کلمات کلیدی ذخیره شد.' : 'Keywords saved.');
    } finally {
      setKeywordSaving(false);
    }
  };

  const updKeywordEdit = (shopId: string, val: string) => setKeywordEdits(prev => ({ ...prev, [shopId]: val }));

  const openAnalytics = async (shop: MetaShop) => {
    setAnalyticsShopId(shop.id); setAnalyticsEvents([]); setAnalyticsLoading(true); setMode('analytics');
    try { setAnalyticsEvents(await fetchMetaShopEvents(shop.id)); }
    finally { setAnalyticsLoading(false); }
  };

  // Live refresh while the visit report is open (poll — no listener needed).
  useEffect(() => {
    if (mode !== 'analytics' || !analyticsShopId) return;
    let gone = false;
    const timer = setInterval(async () => {
      const events = await fetchMetaShopEvents(analyticsShopId);
      if (!gone && events.length) setAnalyticsEvents(events);
    }, 15_000);
    return () => { gone = true; clearInterval(timer); };
  }, [mode, analyticsShopId]);

  const t = {
    title: T ? 'متاشاپ' : 'Meta Shop', subtitle: T ? 'فروشگاه‌های آنلاین شما' : 'Your online shops',
    newShop: T ? 'فروشگاه جدید' : 'New Shop', importJson: T ? 'ساخت از JSON' : 'Import from JSON',
    empty: T ? 'هنوز فروشگاهی نساخته‌اید.' : 'No shops yet.',
    edit: T ? 'ویرایش' : 'Edit', del: T ? 'حذف' : 'Delete', open: T ? 'باز کردن' : 'Open', copy: T ? 'کپی لینک' : 'Copy link', copied: T ? 'کپی شد ✓' : 'Copied ✓',
    orders: T ? 'سفارش‌ها' : 'Orders', active: T ? 'فعال' : 'Active', inactive: T ? 'غیرفعال' : 'Inactive',
    analytics: T ? 'گزارش بازدید' : 'Visit report',
    anTitle: T ? 'گزارش بازدید' : 'Visit report',
    anLoading: T ? 'در حال بارگذاری گزارش…' : 'Loading report…',
    anEmpty: T ? 'هنوز بازدیدی ثبت نشده است. به‌محض بازدید مشتری‌ها از لینک فروشگاه، آمار اینجا نمایش داده می‌شود.' : 'No visits recorded yet. Once customers open the shop link, stats will appear here.',
    anEmptyRange: T ? 'در این بازهٔ زمانی بازدیدی ثبت نشده است. بازهٔ دیگری را انتخاب کنید.' : 'No visits in this time range. Try another range.',
    anVisits: T ? 'بازدید' : 'Visits',
    anVisitors: T ? 'بازدیدکننده یکتا' : 'Unique visitors',
    anClicks: T ? 'کلیک روی محصول' : 'Product clicks',
    anAddCart: T ? 'افزودن به سبد' : 'Add to cart',
    anConv: T ? 'نرخ تبدیل به سبد' : 'Cart conversion',
    anCountries: T ? 'کشورهای بازدیدکننده' : 'Visitor countries',
    anTopProducts: T ? 'پربازدیدترین محصولات (کلیک)' : 'Most-clicked products',
    anTopCart: T ? 'بیشترین افزوده‌شده به سبد' : 'Most added to cart',
    anDevices: T ? 'دستگاه' : 'Devices',
    anReferrers: T ? 'منبع ورود' : 'Traffic sources',
    anTrend: T ? 'بازدید ۱۴ روز اخیر' : 'Visits — last 14 days',
    anCities: T ? 'شهرها' : 'Cities',
    anMobile: T ? 'موبایل' : 'Mobile', anTablet: T ? 'تبلت' : 'Tablet', anDesktop: T ? 'دسکتاپ' : 'Desktop',
    anDirect: T ? 'مستقیم' : 'Direct', anUnknown: T ? 'نامشخص' : 'Unknown', anNone: T ? '—' : '—',
    anRefresh: T ? 'به‌روزرسانی' : 'Refresh',
    anVia: T ? 'از گوگل‌سایت' : 'via Google Site',
    anToday: T ? 'امروز' : 'Today', anWeek: T ? '۷ روز' : '7 days', anMonth: T ? '۳۰ روز' : '30 days', anAll: T ? 'کل' : 'All',
    downloadJson: T ? 'دانلود فایل JSON این فروشگاه' : 'Download this shop as JSON', updateJson: T ? 'به‌روزرسانی از فایل JSON' : 'Update from JSON file',
    dirT: T ? 'دسته‌بندی در بازارچه (لینک همه فروشگاه‌ها)' : 'Bazaar category (all-shops page)',
    dirHint: T ? 'این فروشگاه در صفحه‌ی «همه فروشگاه‌ها» زیر این دسته‌ها نمایش داده می‌شود. دسته‌ها دوزبانه‌اند (فارسی و انگلیسی).' : 'This shop appears under these categories on the all-shops page. Categories are bilingual (FA & EN).',
    dirCat: T ? 'دسته‌ها' : 'Categories', dirCatMulti: T ? '(می‌توانید چند دسته اضافه کنید)' : '(add several)', dirSub: T ? 'زیردسته' : 'Subcategory', shopNo: T ? 'شماره مغازه (پلاک)' : 'Shop number (plate)',
    allShopsLink: T ? 'لینک همه فروشگاه‌ها' : 'All-shops link', allShopsCopied: T ? 'کپی شد ✓' : 'Copied ✓', openBazaar: T ? 'بازارچه' : 'Bazaar',
    back: T ? 'بازگشت' : 'Back', save: T ? 'ذخیره فروشگاه' : 'Save shop', cancel: T ? 'انصراف' : 'Cancel',
    basics: T ? 'اطلاعات پایه' : 'Basics', theme: T ? 'رنگ‌بندی قالب' : 'Theme', cover: T ? 'کاور و معرفی' : 'Cover & intro',
    contact: T ? 'تماس و فوتر' : 'Contact & footer', routing: T ? 'ارجاع سفارش‌ها' : 'Order routing', productsT: T ? 'محصولات / خدمات' : 'Products / Services',
    name: T ? 'نام فروشگاه' : 'Shop name', slug: T ? 'شناسه لینک (slug)' : 'Link slug', type: T ? 'نوع' : 'Type',
    code: T ? 'کد فروشگاه' : 'Shop code', regen: T ? 'کد جدید' : 'New code', copyCode: T ? 'کپی کد' : 'Copy code', codeCopied: T ? 'کپی شد ✓' : 'Copied ✓',
    sfTagFa: T ? 'متن نوار ویترین (فارسی)' : 'Storefront banner (FA)', sfTagEn: T ? 'متن نوار ویترین (انگلیسی)' : 'Storefront banner (EN)',
    sfColor: T ? 'رنگ شاخص ویترین در بازارچه' : 'Storefront color in bazaar', sfColorHint: T ? 'اختیاری — برای متمایز شدن در لیست‌ها' : 'Optional — to stand out in lists', sfClear: T ? 'پیش‌فرض' : 'Default',
    typeProducts: T ? 'محصولات' : 'Products', typeServices: T ? 'خدمات' : 'Services', typeRealEstate: T ? 'املاک' : 'Real Estate',
    currency: T ? 'واحد پول' : 'Currency',
    defLang: T ? 'زبان پیش‌فرض نمایش' : 'Default display language', langFa: T ? 'فارسی' : 'Persian', langEn: T ? 'انگلیسی' : 'English',
    langsT: T ? 'زبان‌های فروشگاه' : 'Shop languages', langsHint: T ? 'زبان‌هایی که مشتری می‌تواند بین آن‌ها سوییچ کند — هر کدی مثل fa، en، ar، zh، tr. ترجمهٔ نام/توضیحات هر محصول را در همان محصول (دکمه 🌐) وارد کنید.' : 'Languages visitors can switch between — any code like fa, en, ar, zh, tr. Enter product translations on each product (🌐 button).',
    langCode: T ? 'کد' : 'Code', langName: T ? 'نام نمایشی' : 'Display name', langRtl: T ? 'راست‌چین' : 'RTL', addLang: T ? 'افزودن زبان' : 'Add language',
    transBtn: T ? 'ترجمه‌ها' : 'Translations', transFor: T ? 'ترجمه برای' : 'Translation for',
    pagesT: T ? 'صفحات و تب‌ها' : 'Pages & Tabs', pagesHint: T ? 'تب‌های اضافی فروشگاه مثل «درباره ما» یا «گواهینامه‌ها». تب «محصولات/خدمات» همیشه هست. ترجمه هر زبان را با دکمه 🌐 وارد کنید.' : 'Extra shop tabs like About Us or Certifications. The products tab is always present. Use 🌐 to enter each language.',
    addPage: T ? 'افزودن صفحه' : 'Add page', noPages: T ? 'صفحه‌ای اضافه نشده است.' : 'No pages added.',
    pgLabel: T ? 'عنوان تب (فارسی)' : 'Tab label (FA)', pgLabelEn: T ? 'عنوان تب (انگلیسی)' : 'Tab label (EN)', pgType: T ? 'نوع صفحه' : 'Page type',
    pgDefault: T ? 'محتوای پیش‌فرض (فارسی)' : 'Default content (Persian)',
    pgI18n: T ? 'ترجمه‌های این صفحه' : 'Page translations',
    pgI18nHint: T ? 'برای هر زبان فروشگاه عنوان تب و متن را جداگانه وارد کنید. اگر خالی بماند از فارسی یا انگلیسی استفاده می‌شود.' : 'Enter tab title and text per shop language. Empty fields fall back to Persian or English.',
    pgCardI18n: T ? 'ترجمه کارت' : 'Card translations',
    pgText: T ? 'متن + تصویر' : 'Text + images', pgGallery: T ? 'گالری عکس' : 'Photo gallery', pgCards: T ? 'کارت‌ها (گواهینامه/شرکا)' : 'Cards (certs/partners)',
    pgBody: T ? 'متن (فارسی)' : 'Body (FA)', pgBodyEn: T ? 'متن (انگلیسی)' : 'Body (EN)', pgDesc: T ? 'توضیح (فارسی)' : 'Description (FA)', pgDescEn: T ? 'توضیح (انگلیسی)' : 'Description (EN)',
    pgImages: T ? 'تصاویر' : 'Images', pgAddImg: T ? 'افزودن تصویر' : 'Add image', pgCardsList: T ? 'کارت‌ها' : 'Cards', pgAddCard: T ? 'افزودن کارت' : 'Add card',
    cardName: T ? 'عنوان (فارسی)' : 'Name (FA)', cardNameEn: T ? 'عنوان (انگلیسی)' : 'Name (EN)', cardDesc: T ? 'توضیح (فارسی)' : 'Desc (FA)', cardDescEn: T ? 'توضیح (انگلیسی)' : 'Desc (EN)',
    productsTabLabel: T ? 'عنوان تب محصولات (پیش‌فرض فارسی)' : 'Products tab label (default FA)',
    productsTabI18n: T ? 'عنوان تب محصولات به زبان‌های دیگر' : 'Products tab label — other languages',
    productsTabI18nHint: T ? 'مثلاً برای عربی، چینی و… — در فروشگاه وقتی مشتری آن زبان را انتخاب کند این عنوان نمایش داده می‌شود.' : 'e.g. Arabic, Chinese… — shown when the customer switches to that language.',
    moveUp: T ? 'بالا' : 'Up', moveDown: T ? 'پایین' : 'Down',
    feesT: T ? 'هزینه‌های اضافی (ارسال، بسته‌بندی، ...)' : 'Extra fees (shipping, packaging, ...)',
    feesHint: T ? 'در صفحه سفارش نمایش داده می‌شوند. برای هر مورد ارز، مبلغ و توضیحات (مثلاً شرایط ارسال رایگان) را وارد کنید.' : 'Shown at checkout. Set currency, amount and notes per fee (e.g. free-shipping rules).',
    addFee: T ? 'افزودن هزینه' : 'Add fee', feeLabel: T ? 'عنوان (فارسی)' : 'Label (FA)', feeLabelEn: T ? 'عنوان (انگلیسی)' : 'Label (EN)', feeAmount: T ? 'مبلغ' : 'Amount',
    feeCurrency: T ? 'ارز' : 'Currency', feeDesc: T ? 'توضیحات (فارسی)' : 'Notes (FA)', feeDescEn: T ? 'توضیحات (انگلیسی)' : 'Notes (EN)',
    feeDescPh: T ? 'مثلاً: خرید بالای ۲۰ ریال در شهر مسقط رایگان است. برای سایر شهرها هزینه جداگانه محاسبه می‌شود.' : 'e.g. Free shipping above 20 OMR in Muscat. Other cities quoted separately.',
    feeRequired: T ? 'الزامی' : 'Required', feeDefaultOn: T ? 'پیش‌فعال' : 'Pre-checked', noFees: T ? 'هزینه‌ای تعریف نشده است.' : 'No fees defined.',
    dispCurT: T ? 'ارزهای نمایشی در وب‌سایت' : 'Storefront display currencies',
    dispCurHint: T ? 'ارز پایه فروشگاه بالا است. نرخ = چند واحد از این ارز معادل ۱ واحد ارز پایه (مثلاً ۱ ریال عمان = ۲٫۶ دلار → نرخ USD برابر ۲٫۶).' : 'Base currency is above. Rate = units of this currency per 1 base unit (e.g. 1 OMR = 2.6 USD → USD rate 2.6).',
    dispCurAdd: T ? 'افزودن ارز' : 'Add currency', dispCurCode: T ? 'کد ارز' : 'Code', dispCurName: T ? 'نام (فارسی)' : 'Name (FA)',
    dispCurNameEn: T ? 'نام (انگلیسی)' : 'Name (EN)', dispCurRate: T ? 'نرخ تبدیل' : 'Exchange rate',
    taxT: T ? 'مالیات (VAT)' : 'Tax (VAT)', taxEnabled: T ? 'فعال‌سازی VAT در فروشگاه' : 'Enable VAT for this shop',
    taxRate: T ? 'درصد مالیات' : 'Tax rate (%)', taxMode: T ? 'حالت' : 'Mode',
    taxIncl: T ? 'تجمیعی (داخل قیمت) — Inclusive' : 'Inclusive (in prices)', taxExcl: T ? 'افزوده به جمع — Exclusive' : 'Exclusive (added on top)',
    taxLabelF: T ? 'عنوان مالیات (فارسی)' : 'Tax label (FA)', taxLabelEnF: T ? 'عنوان مالیات (انگلیسی)' : 'Tax label (EN)',
    taxHint: T ? 'با خاموش کردن تیک، VAT در کل فروشگاه و پیش‌فاکتور مشتری نمایش داده نمی‌شود. درصد و حالت فقط وقتی تیک روشن است اعمال می‌شود.' : 'When unchecked, VAT is hidden everywhere for customers. Rate and mode apply only when enabled.',
    discT: T ? 'کدهای تخفیف' : 'Discount codes', discHint: T ? 'مشتری کد را در صفحه سفارش وارد می‌کند. می‌توانی کد دلخواه بنویسی یا تولید کنی، نوع درصدی/عددی، و دامنه‌ی اعمال (کل سفارش، محصولات خاص، یا دسته‌ها) را تعیین کنی.' : 'Customer enters the code at checkout. Use a custom code or generate one; percent/fixed; scope (whole order, specific products, or categories).',
    addDisc: T ? 'افزودن کد' : 'Add code', noDisc: T ? 'کد تخفیفی تعریف نشده است.' : 'No discount codes.', gen: T ? 'تولید کد' : 'Generate',
    discCode: T ? 'کد' : 'Code', discTypePercent: T ? 'درصدی (٪)' : 'Percent (%)', discTypeFixed: T ? 'عددی (مبلغ)' : 'Fixed amount', discValue: T ? 'مقدار' : 'Value',
    discScope: T ? 'دامنه اعمال' : 'Applies to', scopeAll: T ? 'کل سفارش' : 'Whole order', scopeProducts: T ? 'محصولات انتخابی' : 'Selected products', scopeCats: T ? 'دسته‌های انتخابی' : 'Selected categories',
    discMin: T ? 'حداقل مبلغ سفارش (اختیاری)' : 'Min order (optional)', selectProducts: T ? 'محصولات مشمول:' : 'Eligible products:', selectCats: T ? 'دسته‌های مشمول:' : 'Eligible categories:',
    primary: T ? 'رنگ اصلی' : 'Primary', coverC: T ? 'رنگ کاور' : 'Cover', coverText: T ? 'متن کاور' : 'Cover text', bg: T ? 'پس‌زمینه' : 'Background',
    collection: T ? 'متن بالای عنوان' : 'Collection text', heroTitle: T ? 'عنوان اصلی' : 'Title', heroSub: T ? 'زیرعنوان' : 'Subtitle',
    coverI18n: T ? 'عنوان و متون کاور به زبان‌های دیگر' : 'Cover texts — other languages',
    coverI18nHint: T ? 'ترجمه‌های واردشده از JSON اینجا نمایش داده می‌شوند. فارسی را در فیلدهای بالا ویرایش کنید.' : 'Translations from JSON import appear here. Edit Persian in the fields above.',
    coverImg: T ? 'تصویر کاور (پس‌زمینه)' : 'Cover image (background)', logo: T ? 'لوگو' : 'Logo', upload: T ? 'آپلود' : 'Upload', uploading: T ? 'در حال آپلود...' : 'Uploading...',
    orLink: T ? 'یا لینک تصویر' : 'or image URL', addLink: T ? 'افزودن لینک' : 'Add URL', imgUrlPh: T ? 'https://...  (لینک عکس)' : 'https://...  (image URL)',
    phone: T ? 'تلفن (پیش‌فرض همه ملک‌ها)' : 'Phone (default for all properties)',
    whatsapp: T ? 'واتس‌اپ (پیش‌فرض همه ملک‌ها)' : 'WhatsApp (default for all properties)',
    whatsappHint: T ? 'با + و کد کشور وارد کنید، مثلاً +96891234567' : 'Include country code, e.g. +96891234567',
    contactReHint: T ? 'برای شماره مخصوص هر ملک، در ویرایش همان ملک بخش «مشاور / تماس» را پر کنید.' : 'For a property-specific number, fill the «Agent / contact» section when editing that property.',
    footerI18n: T ? 'فوتر و آدرس به زبان‌های مختلف' : 'Footer & address per language',
    footerI18nHint: T ? 'متن و آدرس هر زبان را جداگانه بنویسید. اگر خالی بماند، از فیلد پیش‌فرض بالا استفاده می‌شود.' : 'Enter footer text and address per language. Empty fields fall back to the defaults above.',
    email: T ? 'ایمیل' : 'Email', website: T ? 'وب‌سایت' : 'Website', address: T ? 'آدرس (پیش‌فرض)' : 'Address (default)', footer: T ? 'متن فوتر (پیش‌فرض)' : 'Footer text (default)',
    agentSection: T ? 'مشاور / تماس (اختیاری — جایگزین پیش‌فرض فروشگاه)' : 'Agent / contact (optional — overrides shop default)',
    agentName: T ? 'نام مشاور' : 'Agent name', agentPhone: T ? 'تلفن مشاور' : 'Agent phone', agentWhatsapp: T ? 'واتس‌اپ مشاور' : 'Agent WhatsApp',
    agentHint: T ? 'خالی = استفاده از شماره پیش‌فرض فروشگاه (بخش تماس و فوتر)' : 'Leave empty to use the shop default (Contact & footer section)',
    thanksTxt: T ? 'متن تشکر پس از سفارش' : 'Order thank-you text', cartBtn: T ? 'متن دکمه سفارش' : 'Order button text',
    invoiceHint: T ? 'متن پایین پیش‌فاکتور' : 'Proforma invoice footnote',
    invoiceHintHint: T ? 'در پیش‌نمایش فاکتور (قبل از ثبت نهایی) زیر جمع نمایش داده می‌شود. اگر خالی بماند از متن پیش‌فرض استفاده می‌شود.' : 'Shown below the total on the invoice preview before submit. Leave empty for the default text.',
    invoiceHintShow: T ? 'نمایش متن پایین پیش‌فاکتور' : 'Show proforma footnote',
    invoiceHintShowHint: T ? 'اگر تیک را بردارید، هیچ متنی زیر جمع فاکتور نمایش داده نمی‌شود.' : 'Uncheck to hide the footnote below the invoice total entirely.',
    invoiceHintI18n: T ? 'متن پیش‌فاکتور به زبان‌های دیگر' : 'Proforma footnote — other languages',
    routeHint: T ? 'سفارش‌های این فروشگاه به کارتابل چه کسانی برود؟' : 'Whose cartable should orders go to?',
    routePersonnel: T ? 'پرسنل مشخص' : 'Specific personnel', routeDept: T ? 'یک دپارتمان' : 'A department', routeNone: T ? 'پیش‌فرض (مستر)' : 'Default (master)',
    editorAccess: T ? 'دسترسی ویرایش در پنل' : 'Panel edit access',
    editorAccessHint: T ? 'پرسنلی که می‌تواند این فروشگاه را در پنل متاشاپ ببیند و ویرایش کند. خالی = همه پرسنل دارای مجوز متاشاپ.' : 'Staff who can view/edit this shop in the Meta Shop panel. Empty = all staff with Meta Shop permission.',
    addProduct: T ? 'افزودن مورد' : 'Add item', noProducts: T ? 'موردی اضافه نشده است.' : 'No items added.',
    pName: T ? 'نام' : 'Name', pSku: T ? 'کد (SKU)' : 'SKU', pGroup: T ? 'دسته' : 'Category', pSubcat: T ? 'زیردسته' : 'Subcategory', pPrice: T ? 'قیمت' : 'Price', pPack: T ? 'قیمت بسته' : 'Pack price',
    pCurrency: T ? 'ارز محصول' : 'Currency', optCur: T ? 'ارز' : 'Cur',
    pUnit: T ? 'واحد' : 'Unit', pPackSize: T ? 'تعداد در بسته' : 'Pack size', pMoq: T ? 'حداقل سفارش' : 'MOQ', pStock: T ? 'وضعیت موجودی' : 'Stock label', pDesc: T ? 'توضیحات' : 'Description', pImg: T ? 'تصویر' : 'Image',
    pKeywords: T ? 'کلمات کلیدی جستجو' : 'Search keywords',
    pKeywordsHint: T ? 'با ویرگول جدا کنید — در جستجوی سایت و فروشگاه بین‌المللی' : 'Comma-separated — used in site & international shop search',
    searchKeywords: T ? 'کلمات کلیدی فروشگاه' : 'Shop search keywords',
    searchKeywordsHint: T ? 'هر چند کلمه که می‌خواهید با ویرگول یا خط جدید جدا کنید. مشتری با جستجوی این کلمات فروشگاه و محصولاتش را پیدا می‌کند.' : 'Add as many terms as you like, separated by commas or new lines. Customers find this shop and its products when searching these terms.',
    keywordsBulk: T ? 'کلمات کلیدی (کلی)' : 'Keywords (bulk)',
    keywordsBulkTitle: T ? 'مدیریت کلمات کلیدی فروشگاه‌ها' : 'Shop keywords — bulk edit',
    keywordsBulkHint: T ? 'کلمات هر فروشگاه را اینجا یکجا ویرایش کنید. با ویرگول یا خط جدید جدا کنید. در جستجوی سایت و فروشگاه بین‌المللی استفاده می‌شود.' : 'Edit keywords for all shops in one place. Separate with commas or new lines. Used in site search and the international shop page.',
    keywordsBulkSearch: T ? 'جستجو در فروشگاه‌ها...' : 'Search shops...',
    listSearch: T ? 'جستجوی فروشگاه (نام، slug، کد، کلمات کلیدی)...' : 'Search shops (name, slug, code, keywords)...',
    listSearchEmpty: T ? 'فروشگاهی با این جستجو پیدا نشد.' : 'No shops match your search.',
    keywordsBulkSave: T ? 'ذخیره همه' : 'Save all',
    keywordsBulkSaved: T ? 'ذخیره شد' : 'Saved',
    keywordsBulkEmpty: T ? 'فروشگاهی یافت نشد.' : 'No shops found.',
    keywordsBulkCount: (n: number) => T ? `${n} فروشگاه` : `${n} shop${n === 1 ? '' : 's'}`,
    pVideo: T ? 'لینک ویدئو (YouTube / Vimeo / mp4)' : 'Video link (YouTube / Vimeo / mp4)',
    rateOptions: T ? 'نرخ‌های چندگانه (حداکثر ۳)' : 'Rate options (max 3)',
    pDiscount: T ? 'تخفیف' : 'Discount', pDiscNone: T ? 'بدون تخفیف' : 'No discount', pDiscPercent: T ? 'درصدی (٪)' : 'Percent (%)', pDiscAmount: T ? 'مبلغی' : 'Amount',
    pDiscValue: T ? 'مقدار تخفیف' : 'Discount value', pDiscHint: T ? 'قیمت قبل (خط‌خورده) و بعد به مشتری نمایش داده می‌شود.' : 'Before (struck-through) and after price are shown to the customer.',
    featured: T ? 'ویژه' : 'Featured', featuredFull: T ? 'حداکثر ۳ محصول ویژه' : 'Max 3 featured products',
    hidePrice: T ? 'قابل مذاکره' : 'Negotiable', hidePriceTip: T ? 'قیمت نمایش داده نمی‌شود؛ مشتری تعداد را ثبت می‌کند تا بعداً قیمت بدهید.' : 'Hide price; the customer orders a quantity and you quote later.',
    outOfStock: T ? 'ناموجود' : 'Out of stock', outOfStockTip: T ? 'محصول با برچسب «در حال حاضر موجود نیست» نمایش داده می‌شود و مشتری نمی‌تواند آن را سفارش دهد.' : 'Shown as «Currently unavailable»; customers cannot order it.',
    hideAllPrices: T ? 'مخفی‌کردن قیمت همه‌ی محصولات (قابل مذاکره)' : 'Hide all product prices (negotiable)',
    hideAllPricesTip: T ? 'هیچ قیمتی در فروشگاه، کاتالوگ و فاکتور نمایش داده نمی‌شود؛ سفارش‌ها فقط تعداد را ثبت می‌کنند.' : 'No prices shown in the shop, catalog or invoices; orders capture quantities only.',
    priceLabel: T ? 'متن جای قیمت' : 'Price label', priceLabelDefault: T ? 'قابل مذاکره (پیش‌فرض)' : 'Negotiable (default)',
    priceLabelContact: 'Please contact us for the new price',
    priceLabelI18n: T ? 'متن جای قیمت به ازای هر زبان' : 'Price label per language',
    priceLabelInherit: T ? 'مثل فروشگاه' : 'Same as shop',
    priceLabelTip: T ? 'وقتی قیمت مخفی است، این متن به‌جای «قابل مذاکره» نمایش داده می‌شود.' : 'Shown instead of «Negotiable» when the price is hidden.',
    productImageFit: T ? 'نمایش تصویر محصولات' : 'Product image display',
    imageFitCover: T ? 'پر کردن کادر (برش)' : 'Fill frame (crop)',
    imageFitContain: T ? 'جا دادن کامل (fit)' : 'Fit inside frame',
    imageFitInherit: T ? 'پیش‌فرض فروشگاه' : 'Shop default',
    productImageFitTip: T ? 'برای تصاویر بزرگ یا لینک‌های خارجی، «جا دادن کامل» معمولاً بهتر است.' : 'For large or external URL images, «Fit inside frame» usually works better.',
    rateHint: T ? 'مثلا: ۱ روز / ۳ روز / ۱۰ روز — یا EXW / FOB / CIF — یا با کرایه / بدون کرایه. اگر تعریف کنی، مشتری یکی را انتخاب می‌کند و همان قیمت اعمال می‌شود.' : 'e.g. 1 day / 3 days / 10 days — or EXW / FOB / CIF — or with/without freight. If set, the customer picks one and that price applies.',
    addRate: T ? 'افزودن نرخ' : 'Add rate', optLabel: T ? 'عنوان (فارسی)' : 'Label (FA)', optLabelEn: T ? 'عنوان (انگلیسی)' : 'Label (EN)', optPrice: T ? 'قیمت' : 'Price',
    importHint: T ? 'JSON کاتالوگ یا فروشگاه را اینجا بچسبانید. محصولات، رنگ‌ها و اطلاعات شرکت خودکار وارد می‌شوند.' : 'Paste catalog or shop JSON. Products, colors and company info are imported automatically.',
    importBtn: T ? 'وارد کردن' : 'Import', importErr: T ? 'JSON نامعتبر است.' : 'Invalid JSON.',
    ordersTitle: T ? 'سفارش‌ها' : 'Orders', allOrdersTitle: T ? 'مرکز مدیریت سفارش‌ها' : 'Orders command center', allOrdersBtn: T ? 'مرکز سفارش‌ها' : 'Orders hub', noOrders: T ? 'سفارشی ثبت نشده است.' : 'No orders yet.',
    oCode: T ? 'کد رهگیری' : 'Tracking', oCustomer: T ? 'مشتری' : 'Customer', oTotal: T ? 'مبلغ' : 'Total', oDate: T ? 'تاریخ' : 'Date', oStatus: T ? 'وضعیت' : 'Status', oItems: T ? 'اقلام' : 'Items',
    sNew: T ? 'جدید' : 'New', sProg: T ? 'در حال انجام' : 'In progress', sDone: T ? 'انجام شد' : 'Done', sCanc: T ? 'لغو شد' : 'Cancelled',
    referrals: T ? 'معرفی ملک' : 'Property referrals',
    referralsTitle: T ? 'معرفی‌های ملک' : 'Property referrals',
    noReferrals: T ? 'معرفی ملکی ثبت نشده است.' : 'No property referrals yet.',
    supplierCollab: T ? 'همکاری تأمین' : 'Supplier collab',
    supplierCollabTitle: T ? 'درخواست‌های همکاری تأمین' : 'Supplier collaboration requests',
    noSupplierCollab: T ? 'درخواست همکاری تأمینی ثبت نشده است.' : 'No supplier collaboration requests yet.',
    supplierCollabEnable: T ? 'دکمه همکاری تأمین در فوتر' : 'Supplier collab button in footer',
    supplierCollabHint: T ? 'بازدیدکنندگان می‌توانند برند و عکس محصولات قابل تأمین خود را ارسال کنند (کنار دانلود کاتالوگ).' : 'Visitors can submit their brand and supplyable product photos (next to PDF catalog).',
    refPending: T ? 'در انتظار' : 'Pending', refApproved: T ? 'تأیید شده' : 'Approved', refRejected: T ? 'رد شده' : 'Rejected',
    refApprove: T ? 'تأیید و افزودن به فروشگاه' : 'Approve & add listing',
    refReject: T ? 'رد' : 'Reject',
    refApproveOk: T ? 'ملک به لیست اضافه شد (غیرفعال). ویرایش کنید و سپس فعالش کنید.' : 'Listing added (inactive). Edit it and activate when ready.',
    refRejectReason: T ? 'دلیل رد (اختیاری)' : 'Rejection reason (optional)',
    refReferrer: T ? 'معرف' : 'Referrer', refRelation: T ? 'نسبت' : 'Relation',
    refPhotos: T ? 'عکس‌ها' : 'Photos', refEditShop: T ? 'ویرایش فروشگاه' : 'Edit shop',
    deleteConfirm: T ? 'این فروشگاه حذف شود؟' : 'Delete this shop?',
    deleteFailed: T ? 'حذف ناموفق بود. اتصال یا مجوز «حذف فروشگاه» را بررسی کنید.' : 'Delete failed. Check connection or shop-delete permission.',
    deleting: T ? 'در حال حذف…' : 'Deleting…',
    linkLabel: T ? 'لینک عمومی:' : 'Public link:',
    // PDF catalog
    catalog: T ? 'کاتالوگ PDF' : 'PDF Catalog',
    catalogTitle: T ? 'ساخت کاتالوگ PDF صادراتی A4 از این فروشگاه (جلد، فهرست، صفحات محصول، کد QR) — آماده چاپ و ذخیره به PDF' : 'Generate an export-grade A4 PDF catalog of this shop (cover, index, product pages, QR) — ready to print / Save as PDF',
    // Google Site / embed export
    gsite: T ? 'گوگل‌سایت' : 'Google Site',
    gsiteTitle: T ? 'تعبیه در گوگل‌سایت یا هر وب‌سایت' : 'Embed in Google Sites or any website',
    gsiteIntro: T ? 'این فروشگاه را با تمام امکانات (سبد خرید، قالب، چندزبانه، پیگیری) داخل گوگل‌سایت قرار بده. مشتری از همان‌جا سفارش می‌دهد و هر «درخواست خرید» مستقیم در کارتابل سامانه ثبت می‌شود — درست مثل لینک مستقیم.' : 'Embed this shop — with every feature (cart, theme, multilingual, tracking) — inside a Google Site. Customers order right there and every purchase request lands directly in the system cartable, just like the direct link.',
    gsiteEmbedUrl: T ? 'لینک تعبیه (embed)' : 'Embed URL',
    gsiteEmbedCode: T ? 'کد iframe (برای «Embed code»)' : 'iframe code (for "Embed code")',
    gsiteHeight: T ? 'ارتفاع قاب (px)' : 'Frame height (px)',
    gsiteCopyUrl: T ? 'کپی لینک' : 'Copy URL',
    gsiteCopyCode: T ? 'کپی کد' : 'Copy code',
    gsiteOpen: T ? 'پیش‌نمایش' : 'Preview',
    gsiteStepsTitle: T ? 'مراحل افزودن به گوگل‌سایت:' : 'How to add it to Google Sites:',
    gsiteStep1: T ? 'در ویرایشگر گوگل‌سایت، از نوار راست «Insert ← Embed» را بزن.' : 'In the Google Sites editor, click "Insert → Embed".',
    gsiteStep2: T ? 'تب «Embed code» را انتخاب کن و کد iframe بالا را بچسبان (یا تب «By URL» و لینک تعبیه را بگذار).' : 'Pick the "Embed code" tab and paste the iframe code above (or use "By URL" with the embed URL).',
    gsiteStep3: T ? 'روی «Next ← Insert» بزن و اندازه‌ی قاب را روی صفحه تنظیم کن. تمام؛ فروشگاه داخل سایت زنده است.' : 'Click "Next → Insert" and resize the frame on the page. Done — the shop is live inside your site.',
    gsiteNote: T ? 'نکته: سفارش‌های ثبت‌شده از داخل گوگل‌سایت در بخش «سفارش‌ها» با برچسب 🌐 گوگل‌سایت مشخص می‌شوند.' : 'Note: orders placed from inside the Google Site are marked with a 🌐 Google Site badge in the Orders tab.',
    seoT: T ? 'اشتراک‌گذاری لینک (واتس‌اپ، تلگرام، …)' : 'Link sharing (WhatsApp, Telegram, …)',
    seoHint: T ? 'وقتی لینک فروشگاه را در پیام‌رسان می‌فرستید، این عنوان، توضیح و تصویر در پیش‌نمایش نمایش داده می‌شود. اگر خالی بماند از نام فروشگاه، لوگو و متن معرفی استفاده می‌شود.' : 'When you share the shop link in a messenger, this title, description and image appear in the preview. Empty fields fall back to shop name, logo and intro text.',
    seoTitle: T ? 'عنوان پیش‌نمایش' : 'Preview title',
    seoTitlePh: T ? 'مثلا: شیراز سوئیتس و آجیل' : 'e.g. Shiraz Sweets & Nuts',
    seoDesc: T ? 'توضیح کوتاه' : 'Short description',
    seoDescPh: T ? 'مثلا: صادرات آجیل و شیرینی‌جات با کیفیت صادراتی' : 'e.g. Export-grade nuts and sweets',
    seoImage: T ? 'تصویر پیش‌نمایش' : 'Preview image',
    seoImageHint: T ? 'ترجیحاً لوگو یا تصویر مربع/افقی — اگر خالی باشد از لوگو و سپس کاور استفاده می‌شود.' : 'Prefer logo or a square/landscape image — falls back to logo then cover.',
    seoPreview: T ? 'پیش‌نمایش' : 'Preview',
    seoI18n: T ? 'عنوان و توضیح به زبان‌های دیگر' : 'Title & description per language',
    seoI18nHint: T ? 'برای هر زبان جداگانه — اگر خالی باشد از فیلدهای بالا یا پیش‌فرض فروشگاه استفاده می‌شود.' : 'Per language — empty fields fall back to the defaults above.',
    seoRefreshHint: T ? 'پس از ذخیره، واتس‌اپ ممکن است تا چند ساعت پیش‌نمایش قبلی را نشان دهد. برای تست سریع از ابزار Facebook Sharing Debugger استفاده کنید.' : 'After saving, WhatsApp may cache the old preview for a while. Use Facebook Sharing Debugger for a quick test.',
    fpsT: T ? 'استیکرهای تبلیغاتی شناور' : 'Floating Promotions',
    fpsHint: T ? 'تا ۳ تصویر PNG شفاف روی فروشگاه نمایش داده می‌شود — قابل جابجایی، لینک، انیمیشن و زمان‌بندی کمپین. بدون نیاز به تغییر قالب.' : 'Up to 3 transparent PNG overlays on the storefront — draggable, linkable, animated, and schedulable. No theme changes needed.',
  };

  const shopTypeBadge = (type: MetaShopType) => type === 'services' ? t.typeServices : type === 'realestate' ? t.typeRealEstate : t.typeProducts;

  const filteredShops = useMemo(() => {
    let list = shopFilter === 'all' ? metaShops : metaShops.filter(s => s.type === shopFilter);
    const q = listSearch.trim();
    if (q) {
      list = list.filter(s => shopMatchesSearch(s, q) || textMatchesSearchQuery(shopCodeOf(s), q));
    }
    return list;
  }, [metaShops, shopFilter, listSearch]);

  const ordersByShop = useMemo(() => {
    const m: Record<string, MetaShopOrder[]> = {};
    metaShopOrders.filter(o => !o.archivedAt).forEach(o => { (m[o.shopId] = m[o.shopId] || []).push(o); });
    return m;
  }, [metaShopOrders]);
  const archivedOrdersByShop = useMemo(() => {
    const m: Record<string, MetaShopOrder[]> = {};
    metaShopOrders.filter(o => !!o.archivedAt).forEach(o => { (m[o.shopId] = m[o.shopId] || []).push(o); });
    return m;
  }, [metaShopOrders]);
  const referralsByShop = useMemo(() => {
    const m: Record<string, MetaShopPropertyReferral[]> = {};
    metaShopReferrals.forEach(r => { (m[r.shopId] = m[r.shopId] || []).push(r); });
    return m;
  }, [metaShopReferrals]);
  const supplierCollabsByShop = useMemo(() => {
    const m: Record<string, MetaShopSupplierCollaboration[]> = {};
    metaShopSupplierCollaborations.forEach(r => { (m[r.shopId] = m[r.shopId] || []).push(r); });
    return m;
  }, [metaShopSupplierCollaborations]);

  const shopUrl = (shop: MetaShop) => `${shopBaseUrl}?shop=${encodeURIComponent(shop.slug)}`;
  const copyLink = (shop: MetaShop) => { navigator.clipboard.writeText(shopUrl(shop)); setCopiedId(shop.id); setTimeout(() => setCopiedId(null), 1800); };
  // Printable A4 PDF catalog link — same shop page with &catalog=1 (opens the print → "Save as PDF" view).
  const catalogUrl = (shop: MetaShop) => `${shopUrl(shop)}&catalog=1`;

  // ── Google Site / iframe embed export ──
  // The embed URL is the live shop page with &embed=1 so it renders compactly and tags orders as gsite-sourced.
  const embedUrl = (shop: MetaShop) => `${shopUrl(shop)}&embed=1`;
  const embedCode = (shop: MetaShop, height: number) =>
    `<iframe src="${embedUrl(shop)}" title="${(shop.name || 'shop').replace(/"/g, '&quot;')}" width="100%" height="${height || 1200}" style="border:0;width:100%;max-width:100%" loading="lazy" allow="clipboard-write; fullscreen"></iframe>`;
  const copyText = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1800); };

  // Download a single shop as a JSON file (re-importable / editable)
  const downloadShopJson = async (shop: MetaShop) => {
    const full = (await hydrateMetaShop(shop)) || shop;
    if (!(full.products?.length) && (full.productCount ?? shop.productCount ?? 0) > 0) {
      alert(T
        ? 'محصولی روی سرور یافت نشد — فایل JSON فقط تنظیمات را دارد. از «بازیابی محصولات» یا پشتیبان کامل استفاده کنید.'
        : 'No products on server — JSON will only contain settings. Use Recover products or a full backup.');
    }
    const exportDoc = {
      ...full,
      _exportNote: (full.products?.length)
        ? undefined
        : (T
          ? 'این فایل بدون محصول است — برای import مجدد از پشتیبان کامل استفاده کنید.'
          : 'Shell-only export — use a full backup to re-import products.'),
    };
    const blob = new Blob([JSON.stringify(exportDoc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `metashop-${full.slug || full.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const recoverShopProducts = async (shop: MetaShop) => {
    if (readonly) return;
    if (!confirm(T ? 'تلاش برای بازیابی محصولات از chunk و پشتیبان؟' : 'Try to recover products from chunks and backups?')) return;
    setRecoveringShopId(shop.id);
    try {
      const ok = await recoverMetaShopFromChunks(shop);
      if (ok) {
        setProductProbe(prev => ({ ...prev, [shop.id]: 'ok' }));
        alert(T ? `${ok.products.length} محصول بازیابی و ذخیره شد.` : `${ok.products.length} products recovered and saved.`);
      } else {
        alert(T
          ? 'محصولی یافت نشد (نه chunk و نه پشتیبان). فایل JSON کامل با آرایه products را import کنید.'
          : 'No products found (chunks or backups). Import a full JSON with a products array.');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : (T ? 'بازیابی ناموفق بود.' : 'Recovery failed.'));
    } finally {
      setRecoveringShopId(null);
    }
  };

  const recoverAllBrokenShops = async () => {
    if (readonly || bulkRecovering) return;
    const broken = metaShops.filter(s => productProbe[s.id] === 'missing');
    if (!broken.length) {
      alert(T ? 'فروشگاه خرابی برای بازیابی یافت نشد.' : 'No broken shops to recover.');
      return;
    }
    if (!confirm(T
      ? `${broken.length} فروشگاه محصولاتشان روی سرور نیست. بازیابی از chunk/پشتیبان انجام شود؟`
      : `${broken.length} shops are missing products on the server. Recover from chunks/backups?`)) return;
    setBulkRecovering(true);
    try {
      const { recovered, failed } = await recoverAllMetaShopsProducts(broken);
      const probePatch: Record<string, 'ok' | 'missing'> = {};
      recovered.forEach(s => { probePatch[s.id] = 'ok'; });
      failed.forEach(s => { probePatch[s.id] = 'missing'; });
      setProductProbe(prev => ({ ...prev, ...probePatch }));
      alert(T
        ? `بازیابی: ${recovered.length} موفق، ${failed.length} ناموفق.`
        : `Recovery: ${recovered.length} ok, ${failed.length} failed.`);
    } finally {
      setBulkRecovering(false);
    }
  };

  // Update an EXISTING shop from an uploaded JSON file (keeps the same id + slug/link)
  const updateShopFromFile = (shop: MetaShop, file: File) => {
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const merged = importFromJson(String(ev.target?.result || ''), shop);
        let updated: MetaShop = { ...merged, id: shop.id, slug: shop.slug, createdAt: shop.createdAt };
        if (!(updated.products?.length) && ((updated.productCount ?? shop.productCount ?? 0) > 0 || (updated.productChunkCount ?? shop.productChunkCount ?? 0) > 0)) {
          const hydrated = await hydrateMetaShop({ ...shop, ...updated });
          if (hydrated?.products?.length) {
            updated = { ...hydrated, ...updated, products: hydrated.products };
          } else {
            alert(T
              ? 'این JSON محصول ندارد و chunk محصول روی سرور هم یافت نشد. فایل پشتیبان کامل (با آرایه products) را import کنید یا از «بازیابی محصولات» استفاده کنید.'
              : 'This JSON has no products and server chunks were not found. Import a full backup with a products array, or use Recover products.');
            return;
          }
        }
        await onSaveMetaShop(updated);
        if (draft && draft.id === shop.id) setDraft(updated);
        alert(T ? 'فروشگاه با موفقیت به‌روزرسانی شد.' : 'Shop updated successfully.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        alert(msg || (T ? 'فایل JSON نامعتبر است.' : 'Invalid JSON file.'));
      }
    };
    r.readAsText(file);
  };
  const triggerUpdate = (shop: MetaShop) => { setUpdateShop(shop); updateFileRef.current?.click(); };

  const startNew = () => {
    priceBaselineRef.current = null;
    priceBaselineShopIdRef.current = null;
    setDraft({ ...blankShop(), code: uniqueShopCode(metaShops) });
    setMode('editor');
  };
  const startEdit = (s: MetaShop) => {
    priceBaselineRef.current = null;
    priceBaselineShopIdRef.current = s.id;
    setEditorProductShown(EDITOR_PRODUCT_PAGE_SIZE);
    setProductsSyncing(false);
    setProductsLoadFailed(false);
    setProductsFullyLoaded(!shopNeedsProductHydration(s));
    setMode('editor');
    setDraft({ ...s, products: [...(s.products || [])] });
    const shopId = s.id;
    const expectedCount = s.productCount ?? 0;
    enrichMetaShopShell(s).then(shell => {
      setDraft(d => (d && d.id === shopId ? { ...d, ...shell, products: d.products } : d));
    }).catch(() => {});
    if (!shopNeedsProductHydration(s)) return;
    setProductsLoading(true);
    loadMetaShopProductsFull(s, (products, loaded, total) => {
      setDraft(d => (d && d.id === shopId ? { ...d, products } : d));
      if (loaded >= 1) setProductsLoading(false);
      setProductsSyncing(loaded < total);
    })
      .then(full => {
        const loaded = full.products?.length ?? 0;
        setDraft(d => (d && d.id === shopId ? { ...d, ...full, products: full.products || [] } : d));
        if (loaded > 0 || expectedCount === 0) {
          setProductsFullyLoaded(true);
          setProductsLoadFailed(false);
        } else {
          setProductsFullyLoaded(false);
          setProductsLoadFailed(true);
        }
      })
      .catch(() => {
        setProductsLoading(false);
        setProductsSyncing(false);
        setProductsLoadFailed(true);
      });
  };

  useEffect(() => {
    if (!draft || mode !== 'editor' || draft.id !== priceBaselineShopIdRef.current) return;
    if (priceBaselineRef.current) return;
    if (shopNeedsProductHydration(draft) && !productsFullyLoaded) return;
    priceBaselineRef.current = cloneProductsBaseline(draft.products || []);
  }, [draft, mode, productsFullyLoaded]);

  const refreshPriceBaseline = (products: MetaShopProduct[]) => {
    priceBaselineRef.current = cloneProductsBaseline(products);
  };

  const logPriceAction = (action: PriceHistoryAction) => {
    setDraft(d => {
      if (!d) return d;
      const currency = d.currency;
      const withCurrency = action.kind === 'bulk_commit'
        ? { ...action, currency }
        : action.kind === 'manual_edit'
          ? { ...action, currency }
          : action;
      return { ...d, priceHistory: appendPriceHistory(d.priceHistory, withCurrency, backupActorName) };
    });
  };

  const draftProductGroups = useMemo(
    () => Array.from(new Set((draft?.products || []).map(p => p.group).filter(Boolean))) as string[],
    [draft?.products],
  );

  const approveReferral = async (ref: MetaShopPropertyReferral) => {
    if (readonly || !onUpdateMetaShopPropertyReferral) return;
    const shop = metaShops.find(s => s.id === ref.shopId);
    if (!shop) return;
    if (!confirm(T ? 'این ملک به لیست فروشگاه اضافه شود؟ (ابتدا غیرفعال است)' : 'Add this property to the shop? (starts inactive)')) return;
    const fullShop = (await hydrateMetaShop(shop)) || shop;
    const productId = `p-${Date.now()}`;
    const product = referralToProduct(ref, fullShop, productId);
    const updated: MetaShop = { ...fullShop, products: [...(fullShop.products || []), product] };
    await onSaveMetaShop(updated);
    await onUpdateMetaShopPropertyReferral(ref.id, { status: 'approved', productId, reviewedAt: new Date().toISOString() });
    if (draft?.id === shop.id) setDraft(updated);
    alert(t.refApproveOk);
  };

  const rejectReferral = async (ref: MetaShopPropertyReferral) => {
    if (readonly || !onUpdateMetaShopPropertyReferral) return;
    const reason = prompt(t.refRejectReason) || undefined;
    await onUpdateMetaShopPropertyReferral(ref.id, { status: 'rejected', rejectReason: reason, reviewedAt: new Date().toISOString() });
  };

  const approveSupplierCollab = async (sub: MetaShopSupplierCollaboration) => {
    if (readonly || !onUpdateMetaShopSupplierCollaboration) return;
    const shop = metaShops.find(s => s.id === sub.shopId);
    if (!shop) return;
    if (!confirm(T ? 'این تأمین‌کننده به لیست فروشگاه اضافه شود؟ (ابتدا غیرفعال است)' : 'Add this supplier as a draft product? (starts inactive)')) return;
    const fullShop = (await hydrateMetaShop(shop)) || shop;
    const productId = `p-${Date.now()}`;
    const product = supplierCollaborationToProduct(sub, fullShop, productId);
    const updated: MetaShop = { ...fullShop, products: [...(fullShop.products || []), product] };
    await onSaveMetaShop(updated);
    await onUpdateMetaShopSupplierCollaboration(sub.id, { status: 'approved', productId, reviewedAt: new Date().toISOString() });
    if (draft?.id === shop.id) setDraft(updated);
    alert(t.refApproveOk);
  };

  const rejectSupplierCollab = async (sub: MetaShopSupplierCollaboration) => {
    if (readonly || !onUpdateMetaShopSupplierCollaboration) return;
    const reason = prompt(t.refRejectReason) || undefined;
    await onUpdateMetaShopSupplierCollaboration(sub.id, { status: 'rejected', rejectReason: reason, reviewedAt: new Date().toISOString() });
  };

  const refStatusLabel = (s: MetaShopPropertyReferral['status']) => s === 'approved' ? t.refApproved : s === 'rejected' ? t.refRejected : t.refPending;
  const refStatusCls = (s: MetaShopPropertyReferral['status']) => s === 'approved' ? 'bg-emerald-100 text-emerald-700' : s === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700';
  const upd = (patch: Partial<MetaShop>) => setDraft(d => d ? { ...d, ...patch } : d);
  const updShopI18n = (code: string, field: string, val: string) => {
    const i18n: Record<string, Record<string, string>> = { ...(draft?.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: val };
    upd({ i18n });
  };
  const updTheme = (patch: Partial<MetaShop['theme']>) => setDraft(d => d ? { ...d, theme: { ...d.theme, ...patch } } : d);
  // Directory categories (bilingual, multi): a shop can appear under several bazaar categories
  const dirCats = (): import('../types').MetaShopDirCat[] => {
    if (draft?.directoryCats && draft.directoryCats.length) return draft.directoryCats;
    if (draft?.directoryCategories && draft.directoryCategories.length) return draft.directoryCategories.map(c => ({ fa: c, en: c }));
    if (draft?.directoryCategory) return [{ fa: draft.directoryCategory, en: draft.directoryCategory }];
    return [];
  };
  const syncLegacyCats = (cats: import('../types').MetaShopDirCat[]) => ({ directoryCats: cats, directoryCategories: cats.map(c => (c.en || c.fa || '').trim()).filter(Boolean), directoryCategory: (cats[0]?.en || cats[0]?.fa || '') });
  const addDirCat = () => {
    const fa = dirCatFa.trim(), en = dirCatEn.trim();
    if (!fa && !en) return;
    const cur = dirCats();
    const key = (en || fa).toLowerCase();
    if (!cur.some(c => ((c.en || c.fa || '').toLowerCase()) === key)) upd(syncLegacyCats([...cur, { fa, en }]));
    setDirCatFa(''); setDirCatEn('');
  };
  const removeDirCat = (idx: number) => upd(syncLegacyCats(dirCats().filter((_, i) => i !== idx)));

  const save = async () => {
    if (!draft) return;
    if (productsLoading || productsSyncing) {
      alert(T ? 'لطفاً تا بارگذاری کامل محصولات صبر کنید.' : 'Please wait until all products are loaded.');
      return;
    }
    if (productsLoadFailed) {
      alert(T
        ? 'محصولات از سرور بارگذاری نشدند. ابتدا «بازیابی محصولات» را بزنید یا JSON کامل import کنید — ذخیره نکنید.'
        : 'Products failed to load from the server. Use Recover or import full JSON first — do not save.');
      return;
    }
    if (shopNeedsProductHydration(draft) && !productsFullyLoaded) {
      alert(T ? 'محصولات هنوز کامل بارگذاری نشده‌اند. کمی صبر کنید و دوباره ذخیره کنید.' : 'Products are not fully loaded yet. Wait and try again.');
      return;
    }
    if (!draft.name.trim()) { alert(T ? 'نام فروشگاه را وارد کنید.' : 'Enter a shop name.'); return; }
    const slug = (draft.slug || '').trim() || slugify(draft.name);
    // ensure unique slug
    if (metaShops.some(s => s.id !== draft.id && s.slug === slug)) { alert(T ? 'این شناسه لینک قبلاً استفاده شده. شناسه دیگری بگذارید.' : 'This slug is already used. Choose another.'); return; }
    // ensure a unique shop code exists
    const code = (draft.code && draft.code.trim()) ? draft.code.trim().toUpperCase() : uniqueShopCode(metaShops);
    setSaving(true);
    try {
      const allowEmptyProducts = productsFullyLoaded && draft.products.length === 0;
      const manualActions = detectManualPriceEdits(priceBaselineRef.current, draft.products, draft.currency);
      const priceHistory = appendPriceHistoryMany(draft.priceHistory, manualActions, backupActorName);
      await onSaveMetaShop({
        ...draft,
        slug,
        code,
        isActive: draft.isActive !== false,
        priceHistory,
      }, { allowEmptyProducts });
      setMode('list'); setDraft(null);
      priceBaselineRef.current = null;
      priceBaselineShopIdRef.current = null;
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : '';
      alert(T
        ? (msg || 'خطا در ذخیره. اگر عکس‌ها را داخل JSON چسبانده‌اید، فقط لینک URL آپلودشده استفاده کنید.')
        : (msg || 'Save failed. Use uploaded image URLs, not embedded base64 in JSON.'));
    }
    finally { setSaving(false); }
  };

  const uploadImg = (file: File, onUrl: (url: string) => void) => uploadFileWithProgress(file, () => {}, onUrl, (e) => alert(e.message), 'images');

  // ── Products editing ──
  const addProduct = () => {
    const base: MetaShopProduct = { id: `p-${Date.now()}`, name: '', images: [], active: true, price: 0, currency: draft!.currency };
    if (draft!.type === 'realestate') base.realEstate = defaultRealEstate();
    upd({ products: [...(draft!.products || []), base] });
  };
  const handleDeleteShop = async (shop: MetaShop) => {
    const docId = String(shop.id || '').trim();
    if (!docId) {
      alert(T ? 'شناسه فروشگاه نامعتبر است. صفحه را رفرش کنید.' : 'Invalid shop id. Refresh the page.');
      return;
    }
    if (!window.confirm(t.deleteConfirm)) return;
    setDeletingShopId(docId);
    try {
      await onDeleteMetaShop(docId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      alert(msg || t.deleteFailed);
    } finally {
      setDeletingShopId(null);
    }
  };

  const updProduct = (idx: number, patch: Partial<MetaShopProduct>) => setDraft(d => { if (!d) return d; const products = [...d.products]; products[idx] = { ...products[idx], ...patch }; return { ...d, products }; });
  const featuredCount = (draft?.products || []).filter(p => p.featured).length;
  const removeProduct = (idx: number) => setDraft(d => d ? { ...d, products: d.products.filter((_, i) => i !== idx) } : d);
  const updProductI18n = (idx: number, code: string, field: string, val: string) => {
    const p = draft!.products[idx];
    const i18n: Record<string, Record<string, string>> = { ...(p.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: val };
    updProduct(idx, { i18n });
  };

  // ── Languages ──
  const shopLangs = () => draft?.languages || [];
  const addLang = () => upd({ languages: [...shopLangs(), { code: '', name: '' }] });
  const updLang = (idx: number, patch: Partial<import('../types').MetaShopLang>) => setDraft(d => { if (!d) return d; const ls = [...(d.languages || [])]; ls[idx] = { ...ls[idx], ...patch }; return { ...d, languages: ls }; });
  const removeLang = (idx: number) => setDraft(d => d ? { ...d, languages: (d.languages || []).filter((_, i) => i !== idx) } : d);
  const langOptions = (): { code: string; name: string }[] => {
    const ls = shopLangs().filter(l => l.code);
    if (ls.length) return ls;
    return draft?.type === 'realestate' ? DEFAULT_REALESTATE_LANGS : DEFAULT_PRODUCT_LANGS;
  };

  // ── Product rate options (max 3) ──
  const addRate = (idx: number) => { const opts = draft!.products[idx].priceOptions || []; if (opts.length >= 3) return; updProduct(idx, { priceOptions: [...opts, { id: `o-${Date.now()}`, label: '', price: 0 }] }); };
  const updRate = (idx: number, oIdx: number, patch: Partial<{ label: string; labelEn: string; price: number; currency: string }>) => {
    const opts = [...(draft!.products[idx].priceOptions || [])];
    const next = { ...opts[oIdx], ...patch };
    if (patch.price != null) next.basePrice = patch.price;
    opts[oIdx] = next;
    updProduct(idx, { priceOptions: opts });
  };
  const removeRate = (idx: number, oIdx: number) => { const opts = (draft!.products[idx].priceOptions || []).filter((_, i) => i !== oIdx); updProduct(idx, { priceOptions: opts.length ? opts : undefined }); };

  // ── Discount codes ──
  const discounts = () => draft?.discounts || [];
  const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 7; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  const addDiscount = () => upd({ discounts: [...discounts(), { id: `disc-${Date.now()}`, code: genCode(), type: 'percent', value: 10, scope: 'all', active: true }] });
  const updDiscount = (idx: number, patch: Partial<import('../types').MetaShopDiscount>) => setDraft(d => { if (!d) return d; const ds = [...(d.discounts || [])]; ds[idx] = { ...ds[idx], ...patch }; return { ...d, discounts: ds }; });
  const removeDiscount = (idx: number) => setDraft(d => d ? { ...d, discounts: (d.discounts || []).filter((_, i) => i !== idx) } : d);
  const draftCategories = (): string[] => { const s: string[] = []; (draft?.products || []).forEach(p => { if (p.group && !s.includes(p.group)) s.push(p.group); }); return s; };

  // ── Default checkout fees ──
  const fees = () => draft?.extraFees || [];
  const feeCurrencyOptions = (): string[] => {
    const base = (draft?.currency || 'OMR').trim().toUpperCase();
    const set = new Set<string>([base]);
    (draft?.displayCurrencies || []).forEach(c => { if (c.code?.trim()) set.add(c.code.trim().toUpperCase()); });
    return [...set];
  };
  const addFee = () => upd({ extraFees: [...fees(), { id: `fee-${Date.now()}`, label: '', amount: 0, currency: draft!.currency || 'OMR' }] });
  const updFee = (idx: number, patch: Partial<import('../types').MetaShopFee>) => setDraft(d => { if (!d) return d; const fs = [...(d.extraFees || [])]; fs[idx] = { ...fs[idx], ...patch }; return { ...d, extraFees: fs }; });
  const removeFee = (idx: number) => setDraft(d => d ? { ...d, extraFees: (d.extraFees || []).filter((_, i) => i !== idx) } : d);
  // ── Pages editing ──
  const pages = () => draft?.pages || [];
  const addPage = () => upd({ pages: [...pages(), { id: `pg-${Date.now()}`, label: T ? 'صفحه جدید' : 'New Page', type: 'text', body: '', images: [], cards: [] }] });
  const updPage = (idx: number, patch: Partial<import('../types').MetaShopPage>) => setDraft(d => { if (!d) return d; const ps = [...(d.pages || [])]; ps[idx] = { ...ps[idx], ...patch }; return { ...d, pages: ps }; });
  const removePage = (idx: number) => setDraft(d => d ? { ...d, pages: (d.pages || []).filter((_, i) => i !== idx) } : d);
  const movePage = (idx: number, dir: -1 | 1) => setDraft(d => { if (!d) return d; const ps = [...(d.pages || [])]; const j = idx + dir; if (j < 0 || j >= ps.length) return d; [ps[idx], ps[j]] = [ps[j], ps[idx]]; return { ...d, pages: ps }; });
  const addPageImage = (idx: number, url: string) => updPage(idx, { images: [...((draft!.pages || [])[idx].images || []), url] });
  const removePageImage = (idx: number, imgIdx: number) => updPage(idx, { images: ((draft!.pages || [])[idx].images || []).filter((_, i) => i !== imgIdx) });
  const addCard = (idx: number) => updPage(idx, { cards: [...((draft!.pages || [])[idx].cards || []), { id: `c-${Date.now()}` }] });
  const updCard = (idx: number, cIdx: number, patch: Partial<import('../types').MetaShopPageCard>) => { const card = ((draft!.pages || [])[idx].cards || []); const next = [...card]; next[cIdx] = { ...next[cIdx], ...patch }; updPage(idx, { cards: next }); };
  const removeCard = (idx: number, cIdx: number) => updPage(idx, { cards: ((draft!.pages || [])[idx].cards || []).filter((_, i) => i !== cIdx) });

  type PageTextField = 'label' | 'body' | 'description';
  type CardTextField = 'name' | 'desc';
  const pageEditorLangs = () => langOptions().filter(l => l.code && l.code !== 'fa');
  const pageLangField = (pg: import('../types').MetaShopPage, code: string, field: PageTextField): string => {
    const fromI18n = pg.i18n?.[code]?.[field];
    if (fromI18n != null && fromI18n !== '') return fromI18n;
    if (code === 'fa') {
      if (field === 'label') return pg.label || '';
      if (field === 'body') return pg.body || '';
      return pg.description || '';
    }
    if (code === 'en') {
      if (field === 'label') return pg.labelEn || '';
      if (field === 'body') return pg.bodyEn || '';
      return pg.descriptionEn || '';
    }
    return '';
  };
  const setPageLangField = (idx: number, code: string, field: PageTextField, val: string) => {
    const pg = (draft!.pages || [])[idx];
    const i18n: Record<string, Record<string, string>> = { ...(pg.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: val };
    const patch: Partial<import('../types').MetaShopPage> = { i18n };
    if (code === 'fa') {
      if (field === 'label') patch.label = val;
      else if (field === 'body') patch.body = val;
      else patch.description = val;
    } else if (code === 'en') {
      if (field === 'label') patch.labelEn = val;
      else if (field === 'body') patch.bodyEn = val;
      else patch.descriptionEn = val;
    }
    updPage(idx, patch);
  };
  const cardLangField = (c: import('../types').MetaShopPageCard, code: string, field: CardTextField): string => {
    const fromI18n = c.i18n?.[code]?.[field];
    if (fromI18n != null && fromI18n !== '') return fromI18n;
    if (code === 'fa') return field === 'name' ? (c.name || '') : (c.desc || '');
    if (code === 'en') return field === 'name' ? (c.nameEn || '') : (c.descEn || '');
    return '';
  };
  const setCardLangField = (idx: number, cIdx: number, code: string, field: CardTextField, val: string) => {
    const c = ((draft!.pages || [])[idx].cards || [])[cIdx];
    const i18n: Record<string, Record<string, string>> = { ...(c.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: val };
    const patch: Partial<import('../types').MetaShopPageCard> = { i18n };
    if (code === 'fa') patch[field === 'name' ? 'name' : 'desc'] = val;
    else if (code === 'en') patch[field === 'name' ? 'nameEn' : 'descEn'] = val;
    updCard(idx, cIdx, patch);
  };

  const setProductsTabLangField = (code: string, val: string) => {
    const i18n: Record<string, Record<string, string>> = { ...(draft?.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), productsTabLabel: val };
    const patch: Partial<MetaShop> = { i18n };
    if (code === 'fa') patch.productsTabLabel = val;
    else if (code === 'en') patch.productsTabLabelEn = val;
    upd(patch);
  };
  const productsTabLangField = (code: string): string => {
    const fromI18n = draft?.i18n?.[code]?.productsTabLabel;
    if (fromI18n != null && fromI18n !== '') return fromI18n;
    if (code === 'fa') return draft?.productsTabLabel || '';
    if (code === 'en') return draft?.productsTabLabelEn || '';
    return '';
  };
  const productsTabPlaceholder = (code: string) => {
    const isAr = code === 'ar';
    if (draft?.type === 'services') return isAr ? 'خدمات' : code === 'en' ? 'Services' : 'خدمات';
    if (draft?.type === 'realestate') return isAr ? 'عقارات' : code === 'en' ? 'Properties' : 'املاک';
    return isAr ? 'منتجات' : code === 'en' ? 'Product List' : 'محصولات';
  };
  const setInvoiceHintLangField = (code: string, val: string) => {
    const i18n: Record<string, Record<string, string>> = { ...(draft?.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), invoiceHintText: val };
    const patch: Partial<MetaShop> = { i18n };
    if (code === 'fa') patch.invoiceHintText = val;
    upd(patch);
  };
  const invoiceHintLangField = (code: string): string => {
    const fromI18n = draft?.i18n?.[code]?.invoiceHintText;
    if (fromI18n != null && fromI18n !== '') return fromI18n;
    if (code === 'fa') return draft?.invoiceHintText || '';
    return '';
  };
  const defaultInvoiceHintPh = T
    ? 'این یک پیش‌فاکتور است؛ مبلغ نهایی پس از بررسی تأیید می‌شود.'
    : 'This is a proforma preview; the final amount is confirmed after review.';

  type CoverI18nField = 'title' | 'subtitle' | 'collectionText' | 'cartButtonText' | 'orderThankYouText';
  const coverLangField = (code: string, field: CoverI18nField): string => {
    const fromI18n = draft?.i18n?.[code]?.[field];
    if (fromI18n != null && fromI18n !== '') return fromI18n;
    if (code === 'fa') {
      if (field === 'title') return draft?.title || '';
      if (field === 'subtitle') return draft?.subtitle || '';
      if (field === 'collectionText') return draft?.collectionText || '';
      if (field === 'cartButtonText') return draft?.cartButtonText || '';
      if (field === 'orderThankYouText') return draft?.orderThankYouText || '';
    }
    return '';
  };
  const setCoverLangField = (code: string, field: CoverI18nField, val: string) => {
    const i18n: Record<string, Record<string, string>> = { ...(draft?.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: val };
    const patch: Partial<MetaShop> = { i18n };
    if (code === 'fa') {
      if (field === 'title') patch.title = val;
      else if (field === 'subtitle') patch.subtitle = val;
      else if (field === 'collectionText') patch.collectionText = val;
      else if (field === 'cartButtonText') patch.cartButtonText = val;
      else if (field === 'orderThankYouText') patch.orderThankYouText = val;
    }
    upd(patch);
  };

  const doImport = () => {
    try { const shop = importFromJson(importText, blankShop()); if (!shop.code) shop.code = uniqueShopCode(metaShops); setDraft(shop); setImportOpen(false); setImportText(''); setMode('editor'); }
    catch { alert(t.importErr); }
  };

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const shop = importFromJson(String(ev.target?.result || ''), blankShop());
        if (!shop.code) shop.code = uniqueShopCode(metaShops);
        setDraft(shop); setImportOpen(false); setImportText(''); setMode('editor');
      } catch { alert(t.importErr); }
    };
    r.readAsText(f); e.target.value = '';
  };

  // Portaled modals — fixed inside animate-fade-in parents breaks viewport centering on long lists.
  const importModalEl = () => (
    <AppModal open={importOpen} onClose={() => setImportOpen(false)} title={t.importJson} dir={T ? 'rtl' : 'ltr'}>
      <p className="text-xs text-gray-500 mb-3">{t.importHint}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-gray-400 self-center">{T ? 'نمونه:' : 'Samples:'}</span>
        <button type="button" onClick={() => downloadSample('products')} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{T ? 'دانلود نمونه محصولات' : 'Products sample'}</button>
        <button type="button" onClick={() => downloadSample('services')} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{T ? 'دانلود نمونه خدمات' : 'Services sample'}</button>
        <button type="button" onClick={() => downloadSample('realestate')} className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50">{T ? 'دانلود نمونه املاک' : 'Real estate sample'}</button>
      </div>
      <button type="button" onClick={() => jsonFileRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-700 font-bold text-sm hover:bg-indigo-50 flex items-center justify-center gap-2">
        <IconUpload className="w-5 h-5" />{T ? 'انتخاب فایل JSON و ساخت فروشگاه' : 'Choose JSON file & build shop'}
      </button>
      <input type="file" ref={jsonFileRef} className="hidden" accept=".json,application/json" onChange={handleJsonFile} />
      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer">{T ? 'یا چسباندن متن JSON' : 'or paste JSON text'}</summary>
        <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} className={fld + ' font-mono text-xs mt-2'} placeholder='{ "type": "products", "products": [ ... ] }' />
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={() => setImportOpen(false)} className="px-3 py-2 text-sm text-gray-500">{t.cancel}</button>
          <button type="button" onClick={doImport} disabled={!importText.trim()} className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg disabled:opacity-50">{t.importBtn}</button>
        </div>
      </details>
    </AppModal>
  );

  const embedModalEl = () => (
    <AppModal open={!!embedShop} onClose={() => setEmbedShop(null)} title={t.gsiteTitle} dir={T ? 'rtl' : 'ltr'} size="lg">
      {embedShop && (<>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{t.gsiteIntro}</p>
        <label className={lbl}>{t.gsiteEmbedUrl}</label>
        <div className="flex items-center gap-2 mb-3">
          <input readOnly value={embedUrl(embedShop)} dir="ltr" onFocus={e => e.currentTarget.select()} className={fld + ' font-mono text-[11px] bg-gray-50'} />
          <button type="button" onClick={() => copyText(embedUrl(embedShop), '__embed_url__')} className="shrink-0 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">{copiedId === '__embed_url__' ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />{t.copied}</> : <><IconCopy className="w-3.5 h-3.5" />{t.gsiteCopyUrl}</>}</button>
        </div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className={lbl + ' mb-0'}>{t.gsiteEmbedCode}</label>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400">{t.gsiteHeight}</span>
            <input type="number" min={400} max={4000} step={50} value={embedHeight} onChange={e => setEmbedHeight(Math.max(400, Math.min(4000, parseInt(e.target.value) || 1200)))} className="w-20 px-2 py-1 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-xs" dir="ltr" />
          </div>
        </div>
        <textarea readOnly rows={3} value={embedCode(embedShop, embedHeight)} dir="ltr" onFocus={e => e.currentTarget.select()} className={fld + ' font-mono text-[11px] bg-gray-50 resize-none'} />
        <div className="flex items-center gap-2 mt-2 mb-4 flex-wrap">
          <button type="button" onClick={() => copyText(embedCode(embedShop, embedHeight), '__embed_code__')} className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-1.5">{copiedId === '__embed_code__' ? <><IconCheck className="w-3.5 h-3.5" />{t.copied}</> : <><IconCopy className="w-3.5 h-3.5" />{t.gsiteCopyCode}</>}</button>
          <a href={embedUrl(embedShop)} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"><IconGlobe className="w-3.5 h-3.5" />{t.gsiteOpen}</a>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
          <div className="text-[13px] font-semibold text-gray-700 mb-2">{t.gsiteStepsTitle}</div>
          <ol className="text-xs text-gray-600 leading-relaxed space-y-1.5 list-decimal ps-4">
            <li>{t.gsiteStep1}</li>
            <li>{t.gsiteStep2}</li>
            <li>{t.gsiteStep3}</li>
          </ol>
          <p className="text-[11px] text-gray-400 mt-2.5">{t.gsiteNote}</p>
        </div>
      </>)}
    </AppModal>
  );

  const statusLabel = (s: MetaShopOrder['status']) => s === 'done' ? t.sDone : s === 'in_progress' ? t.sProg : s === 'cancelled' ? t.sCanc : t.sNew;
  const statusCls = (s: MetaShopOrder['status']) => s === 'done' ? 'bg-emerald-100 text-emerald-700' : s === 'in_progress' ? 'bg-blue-100 text-blue-700' : s === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700';

  const confirmDeleteOrder = (orderId: string) => {
    if (!onDeleteMetaShopOrder) return;
    const msg = T
      ? 'این سفارش از لیست بایگانی شود؟ (داده‌ها در سیستم باقی می‌مانند و قابل بازیابی است.)'
      : 'Archive this order? (Data is kept and can be restored.)';
    if (window.confirm(msg)) void onDeleteMetaShopOrder(orderId);
  };

  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
  const lbl = 'block text-[13px] font-semibold text-gray-700 mb-1.5';
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  // ════════════ LIST ════════════
  // Section toggle (Shops | Bazaars)
  const sectionToggle = (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-1 flex-wrap gap-1">
      <button type="button" onClick={() => setSection('shops')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${section === 'shops' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{T ? 'فروشگاه‌ها' : 'Shops'}</button>
      <button type="button" onClick={() => setSection('bazaars')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${section === 'bazaars' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{T ? 'بازارچه‌ها' : 'Bazaars'}</button>
      <button type="button" onClick={() => setSection('expos')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${section === 'expos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{T ? 'نمایشگاه‌های متاورسی' : 'Metaverse expos'}</button>
      <button type="button" onClick={() => setSection('uploads')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${section === 'uploads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{T ? 'آپلود فایل‌ها' : 'File uploads'}</button>
    </div>
  );

  if (section === 'uploads') {
    return (
      <div className="space-y-4 animate-fade-in">
        {sectionToggle}
        <MetaShopFileUploader lang={lang} readonly={readonly} />
      </div>
    );
  }

  // ════════════ METAVERSE EXPOS section ════════════
  if (section === 'expos' && onSaveMetaBazaar && onDeleteMetaBazaar) {
    return (
      <div className="space-y-4 animate-fade-in">
        {sectionToggle}
        <MetaExpoManager bazaars={metaBazaars} shops={metaShops} lang={lang} shopBaseUrl={shopBaseUrl} onSave={onSaveMetaBazaar} onDelete={onDeleteMetaBazaar} readonly={readonly} canDelete={canDelete} canDeleteBooths={canDeleteBooths} />
      </div>
    );
  }

  // ════════════ BAZAARS section ════════════
  if (section === 'bazaars' && onSaveMetaBazaar && onDeleteMetaBazaar) {
    return (
      <div className="space-y-4 animate-fade-in">
        {sectionToggle}
        <MetaBazaarManager bazaars={metaBazaars} shops={metaShops} lang={lang} shopBaseUrl={shopBaseUrl} onSave={onSaveMetaBazaar} onDelete={onDeleteMetaBazaar} readonly={readonly} canDelete={canDelete} canDeleteBooths={canDeleteBooths} />
      </div>
    );
  }

  if (mode === 'keywords') {
    const q = keywordSearch.trim();
    const rows = metaShops.filter(s => {
      if (!q) return true;
      const hay = `${s.name} ${s.title || ''} ${s.slug} ${shopCodeOf(s)} ${formatSearchKeywordsForInput(s.searchKeywords)}`;
      return textMatchesSearchQuery(hay, q);
    });
    return (
      <div className="space-y-4 animate-fade-in">
        {sectionToggle}
        <button onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><IconSearch className="w-5 h-5 text-indigo-500" />{t.keywordsBulkTitle}</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">{t.keywordsBulkHint}</p>
            <p className="text-[11px] text-gray-400 mt-1">{t.keywordsBulkCount(rows.length)}</p>
          </div>
          {!readonly && (
            <button onClick={saveKeywordsBulk} disabled={keywordSaving} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
              <IconCheck className="w-4 h-4" />{keywordSaving ? '...' : t.keywordsBulkSave}
            </button>
          )}
        </div>
        <div className="relative max-w-md">
          <IconSearch className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={keywordSearch} onChange={e => setKeywordSearch(e.target.value)} placeholder={t.keywordsBulkSearch} />
        </div>
        {rows.length === 0 ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.keywordsBulkEmpty}</div>
        ) : (
          <div className={card + ' p-0 overflow-hidden'}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-start w-[28%]">{T ? 'فروشگاه' : 'Shop'}</th>
                    <th className="px-4 py-3 text-start">{t.searchKeywords}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-800 text-sm">{s.name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{s.title || '—'}</div>
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5" dir="ltr">?shop={s.slug} · {shopCodeOf(s)}</div>
                        {!readonly && (
                          <button type="button" onClick={() => startEdit(s)} className="text-[11px] text-indigo-500 hover:underline mt-1">{t.edit}</button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          className={fld + ' min-h-[64px] text-xs'}
                          value={keywordEdits[s.id] ?? ''}
                          onChange={e => updKeywordEdit(s.id, e.target.value)}
                          placeholder={T ? 'زعفران، saffron، export' : 'saffron, pistachio, export'}
                          disabled={readonly}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'list') {
    return (
      <div className="space-y-5 animate-fade-in">
        {sectionToggle}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><IconTag className="w-5 h-5" /></div>
            <div><h3 className="text-lg font-bold text-gray-800">{t.title}</h3><p className="text-xs text-gray-400">{t.subtitle} ({metaShops.length})</p></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`${shopBaseUrl}?shops=1`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"><IconGlobe className="w-4 h-4" />{t.openBazaar}</a>
            {showAllOrders && (
              <button type="button" onClick={() => setMode('all-orders')} className="px-3 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5">
                {t.allOrdersBtn}
                {metaShopOrders.filter(o => o.status === 'new').length > 0 && (
                  <span className="bg-amber-500 text-white rounded-full px-1.5 text-[10px] font-bold">{metaShopOrders.filter(o => o.status === 'new').length}</span>
                )}
              </button>
            )}
            <button onClick={startKeywordsBulk} className="px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5"><IconSearch className="w-4 h-4" />{t.keywordsBulk}</button>
            {!readonly && Object.values(productProbe).some(v => v === 'missing') && (
              <button
                type="button"
                onClick={recoverAllBrokenShops}
                disabled={bulkRecovering}
                className="px-3 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {bulkRecovering
                  ? (T ? 'در حال بازیابی…' : 'Recovering…')
                  : (T ? `↺ بازیابی همه (${Object.values(productProbe).filter(v => v === 'missing').length})` : `↺ Recover all (${Object.values(productProbe).filter(v => v === 'missing').length})`)}
              </button>
            )}
            <button onClick={() => { navigator.clipboard.writeText(`${shopBaseUrl}?shops=1`); setCopiedId('__bazaar__'); setTimeout(() => setCopiedId(null), 1800); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5">{copiedId === '__bazaar__' ? t.allShopsCopied : <><IconLink className="w-4 h-4" />{t.allShopsLink}</>}</button>
          {!readonly && <>
            <button onClick={() => { setImportOpen(true); setImportText(''); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"><IconUpload className="w-4 h-4" />{t.importJson}</button>
            <button onClick={startNew} className="px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><IconPlus className="w-4 h-4" />{t.newShop}</button>
          </>}
          </div>
        </div>

        {/* Shop type filter tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-xl w-fit">
            {(['all', 'products', 'services', 'realestate'] as const).map(f => (
              <button key={f} type="button" onClick={() => setShopFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${shopFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f === 'all' ? (T ? 'همه' : 'All') : shopTypeBadge(f)}
                <span className="text-gray-400 font-normal ms-1">({f === 'all' ? metaShops.length : metaShops.filter(s => s.type === f).length})</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <IconSearch className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="search"
              className="w-full ps-9 pe-8 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              placeholder={t.listSearch}
            />
            {listSearch.trim() && (
              <button type="button" onClick={() => setListSearch('')} className="absolute top-1/2 -translate-y-1/2 end-2.5 text-gray-400 hover:text-gray-600 text-xs px-1.5" aria-label={T ? 'پاک کردن' : 'Clear'}>✕</button>
            )}
          </div>
          {listSearch.trim() && (
            <span className="text-xs text-gray-500">{filteredShops.length} {T ? 'نتیجه' : 'results'}</span>
          )}
        </div>

        {filteredShops.length === 0 ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>
            {listSearch.trim() ? t.listSearchEmpty : shopFilter === 'all' ? t.empty : (T ? 'فروشگاهی در این دسته نیست.' : 'No shops in this category.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShops.map(s => {
              const orders = ordersByShop[s.id] || [];
              const refs = referralsByShop[s.id] || [];
              const pendingRefs = refs.filter(r => r.status === 'pending').length;
              const collabs = supplierCollabsByShop[s.id] || [];
              const pendingCollabs = collabs.filter(r => r.status === 'pending').length;
              const probeState = productProbe[s.id];
              const productsBroken = probeState === 'missing';
              const productsChecking = probeState === 'pending' && (s.productCount ?? 0) > 0;
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="h-20 flex items-center justify-center text-white font-bold relative" style={{ background: s.theme?.cover || '#334155', backgroundImage: s.coverImage ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.45)), url(${s.coverImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <span className="text-sm px-3 text-center">{s.title || s.name}</span>
                    <span className={`absolute top-2 ${T ? 'left-2' : 'right-2'} text-[10px] px-2 py-0.5 rounded-full font-bold ${s.isActive ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'}`}>{s.isActive ? t.active : t.inactive}</span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-gray-800 text-sm truncate flex items-center gap-1.5">{s.name}<span className="text-[10px] font-mono font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded" dir="ltr">{shopCodeOf(s)}</span></h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{shopTypeBadge(s.type)}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">{(s.productCount ?? (s.products || []).length)} {T ? 'مورد' : 'items'} · {orders.length} {t.orders}</div>
                    {productsChecking && (
                      <p className="text-[11px] text-gray-400">{T ? 'در حال بررسی محصولات…' : 'Checking products…'}</p>
                    )}
                    {productsBroken && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                        {T ? '⚠ محصولات روی سرور نیستند (عدد روی کارت قدیمی است) — بازیابی یا import JSON کامل' : '⚠ Products missing on server (stale count on card) — recover or import full JSON'}
                      </p>
                    )}
                    {(s.searchKeywords?.length || 0) > 0 && (
                      <div className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 line-clamp-2" title={formatSearchKeywordsForInput(s.searchKeywords)}>
                        🔍 {formatSearchKeywordsForInput(s.searchKeywords)}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] text-gray-500 truncate" dir="ltr"><IconLink className="w-3 h-3 shrink-0" /><span className="truncate">?shop={s.slug}</span></div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <a href={shopUrl(s)} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.open}</a>
                      <button onClick={() => copyLink(s)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">{copiedId === s.id ? t.copied : <><IconCopy className="w-3.5 h-3.5" />{t.copy}</>}</button>
                      <button onClick={() => { setEmbedShop(s); }} title={t.gsiteTitle} className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.gsite}</button>
                      <a href={catalogUrl(s)} target="_blank" rel="noreferrer" title={t.catalogTitle} className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1">📄 {t.catalog}</a>
                      <button onClick={() => { setOrdersShopId(s.id); setMode('orders'); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t.orders}{orders.filter(o => o.status === 'new').length > 0 && <span className="ml-1 bg-amber-500 text-white rounded-full px-1.5 text-[10px]">{orders.filter(o => o.status === 'new').length}</span>}</button>
                      {s.type === 'realestate' && (
                        <button onClick={() => { setReferralsShopId(s.id); setMode('referrals'); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50">{t.referrals}{pendingRefs > 0 && <span className="ml-1 bg-teal-600 text-white rounded-full px-1.5 text-[10px]">{pendingRefs}</span>}</button>
                      )}
                      {s.type === 'products' && s.supplierCollaborationEnabled && (
                        <button onClick={() => { setSupplierCollabShopId(s.id); setMode('supplier-collab'); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50">{t.supplierCollab}{pendingCollabs > 0 && <span className="ml-1 bg-violet-600 text-white rounded-full px-1.5 text-[10px]">{pendingCollabs}</span>}</button>
                      )}
                      <button onClick={() => openAnalytics(s)} title={t.analytics} className="text-xs px-2.5 py-1.5 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50 flex items-center gap-1">📊 {t.analytics}</button>
                      <button onClick={() => downloadShopJson(s)} title={t.downloadJson} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">⤓ JSON</button>
                      {!readonly && productsBroken && (
                        <button
                          onClick={() => recoverShopProducts(s)}
                          disabled={recoveringShopId === s.id}
                          title={T ? 'بازیابی محصولات از chunk/پشتیبان' : 'Recover products from chunks/backups'}
                          className="text-xs px-2 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {recoveringShopId === s.id ? '…' : (T ? '↺ بازیابی' : '↺ Recover')}
                        </button>
                      )}
                      {!readonly && <button onClick={() => triggerUpdate(s)} title={t.updateJson} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50">⤒ JSON</button>}
                      {!readonly && <button onClick={() => startEdit(s)} className="text-xs px-2 py-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50"><IconEdit className="w-3.5 h-3.5" /></button>}
                      {!readonly && canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteShop(s)}
                          disabled={deletingShopId === s.id}
                          title={deletingShopId === s.id ? t.deleting : t.del}
                          className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingShopId === s.id ? '…' : <IconTrash className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {importModalEl()}
        {embedModalEl()}
        <input type="file" ref={updateFileRef} className="hidden" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f && updateShop) updateShopFromFile(updateShop, f); e.target.value = ''; setUpdateShop(null); }} />
      </div>
    );
  }

  // ════════════ ORDERS HUB (master) ════════════
  if (mode === 'all-orders') {
    return (
      <MetaShopOrdersHub
        metaShops={metaShops}
        orders={metaShopOrders}
        customerAccounts={customerAccounts}
        shopBaseUrl={shopBaseUrl}
        lang={lang}
        readonly={readonly}
        onUpdateOrder={onUpdateMetaShopOrder}
        onDeleteOrder={onDeleteMetaShopOrder}
        onRestoreOrder={onRestoreMetaShopOrder}
        onBack={backToList}
        sectionToggle={sectionToggle}
      />
    );
  }

  // ════════════ ORDERS ════════════
  if (mode === 'orders') {
    const shop = metaShops.find(s => s.id === ordersShopId);
    const orders = ordersShopId ? (ordersByShop[ordersShopId] || []) : [];
    const archived = ordersShopId ? (archivedOrdersByShop[ordersShopId] || []) : [];
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={backToList} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <h3 className="text-lg font-bold text-gray-800">{t.ordersTitle} — {shop?.name}</h3>
        {sorted.length === 0 ? <div className={card + ' text-center py-12 text-gray-400 text-sm'}>{t.noOrders}</div> : (
          <div className="space-y-4">
            {sorted.map(o => (
              <MetaShopOrderDetailCard
                key={o.id}
                order={o}
                shop={shop}
                shopBaseUrl={shopBaseUrl}
                lang={lang}
                customerAccounts={customerAccounts}
                commissionView="master"
                onStatusChange={status => onUpdateMetaShopOrder(o.id, { status })}
                onDelete={!readonly && onDeleteMetaShopOrder && !o.archivedAt ? () => confirmDeleteOrder(o.id) : undefined}
                onRestore={!readonly && onRestoreMetaShopOrder && o.archivedAt ? () => onRestoreMetaShopOrder(o.id) : undefined}
              />
            ))}
          </div>
        )}
        {archived.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-500">{T ? 'بایگانی‌شده' : 'Archived'}</h4>
            {archived.map(o => (
              <MetaShopOrderDetailCard
                key={o.id}
                order={o}
                shop={shop}
                shopBaseUrl={shopBaseUrl}
                lang={lang}
                customerAccounts={customerAccounts}
                commissionView="master"
                onStatusChange={status => onUpdateMetaShopOrder(o.id, { status })}
                onRestore={!readonly && onRestoreMetaShopOrder ? () => onRestoreMetaShopOrder(o.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════ PROPERTY REFERRALS ════════════
  if (mode === 'referrals') {
    const shop = metaShops.find(s => s.id === referralsShopId);
    const refs = referralsShopId ? (referralsByShop[referralsShopId] || []) : [];
    const relLabel = (r?: string) => r === 'owner' ? (T ? 'مالک' : 'Owner') : r === 'agent' ? (T ? 'مشاور' : 'Agent') : r === 'acquaintance' ? (T ? 'آشنای مالک' : 'Knows owner') : r || '—';
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <h3 className="text-lg font-bold text-gray-800">{t.referralsTitle} — {shop?.name}</h3>
        {refs.length === 0 ? <div className={card + ' text-center py-12 text-gray-400 text-sm'}>{t.noReferrals}</div> : (
          <div className="space-y-4">
            {refs.map(ref => (
              <div key={ref.id} className={card + ' p-4'}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-bold text-gray-800">{ref.propertyTitle || ref.city || (T ? 'ملک معرفی‌شده' : 'Referred property')}</div>
                    <div className="text-xs text-gray-400 font-mono" dir="ltr">{ref.trackingCode} · {new Date(ref.createdAt).toLocaleString(T ? 'fa-IR' : 'en-US')}</div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${refStatusCls(ref.status)}`}>{refStatusLabel(ref.status)}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                  <div><span className="text-gray-500">{t.refReferrer}:</span> <b>{ref.referrerName}</b> <span dir="ltr" className="text-gray-400">({ref.referrerPhone})</span></div>
                  <div><span className="text-gray-500">{t.refRelation}:</span> {relLabel(ref.relation)}</div>
                  {(ref.city || ref.district) && <div><span className="text-gray-500">{T ? 'موقعیت' : 'Location'}:</span> {[ref.city, ref.district].filter(Boolean).join(' · ')}</div>}
                  {ref.areaSqm && <div><span className="text-gray-500">{T ? 'متراژ' : 'Area'}:</span> {ref.areaSqm} m²</div>}
                  {(ref.bedrooms != null || ref.bathrooms != null) && <div>{ref.bedrooms != null && <span>{ref.bedrooms} {T ? 'خواب' : 'bed'} </span>}{ref.bathrooms != null && <span>· {ref.bathrooms} {T ? 'حمام' : 'bath'}</span>}</div>}
                  {ref.price != null && <div><span className="text-gray-500">{T ? 'قیمت' : 'Price'}:</span> {ref.currency} {ref.price.toLocaleString()}</div>}
                  {ref.monthlyRent != null && <div><span className="text-gray-500">{T ? 'اجاره' : 'Rent'}:</span> {ref.currency} {ref.monthlyRent.toLocaleString()}</div>}
                </div>
                {(ref.description || ref.notes) && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 whitespace-pre-wrap">{[ref.description, ref.notes].filter(Boolean).join('\n\n')}</p>}
                {ref.images?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-bold text-gray-500 mb-2">{t.refPhotos}</div>
                    <div className="flex flex-wrap gap-2">{ref.images.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border" /></a>)}</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {ref.status === 'pending' && !readonly && onUpdateMetaShopPropertyReferral && (
                    <>
                      <button onClick={() => approveReferral(ref)} className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700">{t.refApprove}</button>
                      <button onClick={() => rejectReferral(ref)} className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">{t.refReject}</button>
                    </>
                  )}
                  {ref.status === 'approved' && ref.productId && shop && (
                    <button onClick={() => { const s = metaShops.find(x => x.id === shop.id); if (s) startEdit(s); }} className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">{t.refEditShop}</button>
                  )}
                  {ref.status === 'rejected' && ref.rejectReason && <span className="text-xs text-red-500 italic">{ref.rejectReason}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════ SUPPLIER COLLABORATION (product shops) ════════════
  if (mode === 'supplier-collab') {
    const shop = metaShops.find(s => s.id === supplierCollabShopId);
    const subs = supplierCollabShopId ? (supplierCollabsByShop[supplierCollabShopId] || []) : [];
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <h3 className="text-lg font-bold text-gray-800">{t.supplierCollabTitle} — {shop?.name}</h3>
        {subs.length === 0 ? <div className={card + ' text-center py-12 text-gray-400 text-sm'}>{t.noSupplierCollab}</div> : (
          <div className="space-y-4">
            {subs.map(sub => (
              <div key={sub.id} className={card + ' p-4'}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-bold text-gray-800">{sub.brandName}{sub.companyName ? <span className="text-gray-400 font-normal"> · {sub.companyName}</span> : null}</div>
                    <div className="text-xs text-gray-400 font-mono" dir="ltr">{sub.trackingCode} · {new Date(sub.createdAt).toLocaleString(T ? 'fa-IR' : 'en-US')}</div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${refStatusCls(sub.status)}`}>{refStatusLabel(sub.status)}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                  <div><span className="text-gray-500">{t.refReferrer}:</span> <b>{sub.supplierName}</b> <span dir="ltr" className="text-gray-400">({sub.supplierPhone})</span></div>
                  {sub.supplierEmail && <div><span className="text-gray-500">{T ? 'ایمیل' : 'Email'}:</span> <span dir="ltr">{sub.supplierEmail}</span></div>}
                  {(sub.country || sub.city) && <div><span className="text-gray-500">{T ? 'موقعیت' : 'Location'}:</span> {[sub.country, sub.city].filter(Boolean).join(' · ')}</div>}
                </div>
                {(sub.description || sub.notes) && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 whitespace-pre-wrap">{[sub.description, sub.notes].filter(Boolean).join('\n\n')}</p>}
                {sub.images?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-bold text-gray-500 mb-2">{t.refPhotos}</div>
                    <div className="flex flex-wrap gap-2">{sub.images.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border" /></a>)}</div>
                  </div>
                )}
                {sub.catalogPdfUrl && (
                  <div className="mb-3">
                    <div className="text-xs font-bold text-gray-500 mb-2">{T ? 'کاتالوگ PDF' : 'PDF catalog'}</div>
                    <a href={sub.catalogPdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 hover:bg-violet-100" dir="ltr">
                      📄 {sub.catalogPdfName || 'catalog.pdf'}
                    </a>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {sub.status === 'pending' && !readonly && onUpdateMetaShopSupplierCollaboration && (
                    <>
                      <button onClick={() => approveSupplierCollab(sub)} className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700">{t.refApprove}</button>
                      <button onClick={() => rejectSupplierCollab(sub)} className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">{t.refReject}</button>
                    </>
                  )}
                  {sub.status === 'approved' && sub.productId && shop && (
                    <button onClick={() => { const s = metaShops.find(x => x.id === shop.id); if (s) startEdit(s); }} className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">{t.refEditShop}</button>
                  )}
                  {sub.status === 'rejected' && sub.rejectReason && <span className="text-xs text-red-500 italic">{sub.rejectReason}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════ VISIT ANALYTICS REPORT ════════════
  if (mode === 'analytics') {
    const shop = metaShops.find(s => s.id === analyticsShopId);
    // Restrict to the selected time range (computed against each event's timestamp).
    const rangeMs: Record<typeof analyticsRange, number> = { today: 86400000, week: 7 * 86400000, month: 30 * 86400000, all: Infinity };
    const cutoff = Date.now() - rangeMs[analyticsRange];
    const ev = analyticsEvents.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    const hasAny = analyticsEvents.length > 0; // events exist overall, even if none in this range
    const visits = ev.filter(e => e.type === 'visit');
    const clicks = ev.filter(e => e.type === 'product_click');
    const carts = ev.filter(e => e.type === 'add_to_cart');
    const sidSet = (arr: MetaShopEvent[]) => new Set(arr.map(e => e.sessionId).filter(Boolean));
    const visitSids = sidSet(visits), cartSids = sidSet(carts);
    const conv = visitSids.size ? Math.round((cartSids.size / visitSids.size) * 100) : 0;
    const viaGsite = visits.filter(v => v.via === 'gsite').length;

    // ISO country code → flag emoji
    const flag = (cc?: string) => (cc && /^[A-Za-z]{2}$/.test(cc))
      ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🌐';

    // Country tally (with code, for the flag)
    const countryAgg = (() => {
      const m = new Map<string, { count: number; code: string }>();
      for (const e of visits) { const c = e.country; if (!c || c === 'Unknown') continue; const ex = m.get(c) || { count: 0, code: e.countryCode || 'XX' }; ex.count++; m.set(c, ex); }
      return [...m.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    })();
    const maxCountry = countryAgg[0]?.[1].count || 1;

    const tally = (arr: MetaShopEvent[], keyFn: (e: MetaShopEvent) => string | undefined, n = 8) => {
      const m = new Map<string, number>();
      for (const e of arr) { const k = keyFn(e); if (!k) continue; m.set(k, (m.get(k) || 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    };
    const cityAgg = tally(visits, e => (e.city && e.city.trim()) ? e.city : undefined, 6);
    const clickAgg = tally(clicks, e => e.productName || e.productId, 8);
    const cartAgg = tally(carts, e => e.productName || e.productId, 8);
    const refAgg = tally(visits, e => e.referrer || 'direct', 6);
    const devCount = { mobile: 0, tablet: 0, desktop: 0 } as Record<string, number>;
    for (const e of visits) if (e.device) devCount[e.device] = (devCount[e.device] || 0) + 1;
    const devTotal = visits.length || 1;

    // 14-day visit trend — always the last 14 days (independent of the selected range)
    const dayCount = new Map<string, number>();
    for (const e of analyticsEvents) { if (e.type !== 'visit') continue; const d = e.timestamp.slice(0, 10); dayCount.set(d, (dayCount.get(d) || 0) + 1); }
    const trend = Array.from({ length: 14 }, (_, i) => {
      const dt = new Date(Date.now() - (13 - i) * 86400000);
      const key = dt.toISOString().slice(0, 10);
      return { key, label: dt.toLocaleDateString(T ? 'fa-IR' : 'en-US', { month: 'numeric', day: 'numeric' }), count: dayCount.get(key) || 0 };
    });
    const maxTrend = Math.max(1, ...trend.map(d => d.count));

    const barRow = (label: React.ReactNode, value: number, max: number, color = 'bg-sky-500') => (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 w-32 shrink-0 truncate" title={typeof label === 'string' ? label : undefined}>{label}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div>
        <span className="text-xs font-bold text-gray-700 w-8 text-end">{value.toLocaleString()}</span>
      </div>
    );
    const statCard = (label: string, value: React.ReactNode, color: string) => (
      <div className={card + ' p-4 flex flex-col gap-1'}><span className="text-[11px] text-gray-400">{label}</span><span className={`text-2xl font-extrabold ${color}`}>{value}</span></div>
    );
    const panel = (title: string, body: React.ReactNode, empty?: boolean) => (
      <div className={card + ' p-4'}><h4 className="text-sm font-bold text-gray-700 mb-3">{title}</h4>{empty ? <p className="text-xs text-gray-400 py-3 text-center">{t.anNone}</p> : body}</div>
    );

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
          <button onClick={() => shop && openAnalytics(shop)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">↻ {t.anRefresh}</button>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-bold text-gray-800">{t.anTitle} — {shop?.name}</h3>
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            {([['today', t.anToday], ['week', t.anWeek], ['month', t.anMonth], ['all', t.anAll]] as const).map(([r, label]) => (
              <button key={r} onClick={() => setAnalyticsRange(r)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${analyticsRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.anLoading}</div>
        ) : ev.length === 0 ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{hasAny ? t.anEmptyRange : t.anEmpty}</div>
        ) : (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statCard(t.anVisits, visits.length.toLocaleString(), 'text-gray-900')}
              {statCard(t.anClicks, clicks.length.toLocaleString(), 'text-sky-600')}
              {statCard(t.anAddCart, carts.length.toLocaleString(), 'text-emerald-600')}
              {statCard(t.anConv, `${conv}%`, 'text-indigo-600')}
            </div>
            {viaGsite > 0 && <p className="text-[11px] text-indigo-500">🌐 {viaGsite.toLocaleString()} {t.anVisits} {t.anVia}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Countries */}
              {panel(t.anCountries, <div className="space-y-2">{countryAgg.map(([c, info]) => barRow(<span>{flag(info.code)} {c}</span>, info.count, maxCountry))}</div>, countryAgg.length === 0)}
              {/* Top clicked products */}
              {panel(t.anTopProducts, <div className="space-y-2">{clickAgg.map(([n, v]) => barRow(n, v, clickAgg[0]?.[1] || 1))}</div>, clickAgg.length === 0)}
              {/* Top cart products */}
              {panel(t.anTopCart, <div className="space-y-2">{cartAgg.map(([n, v]) => barRow(n, v, cartAgg[0]?.[1] || 1, 'bg-emerald-500'))}</div>, cartAgg.length === 0)}
              {/* Devices */}
              {panel(t.anDevices, <div className="space-y-2">
                {barRow(`📱 ${t.anMobile}`, devCount.mobile, devTotal, 'bg-violet-500')}
                {barRow(`💻 ${t.anDesktop}`, devCount.desktop, devTotal, 'bg-violet-500')}
                {barRow(`📟 ${t.anTablet}`, devCount.tablet, devTotal, 'bg-violet-500')}
              </div>)}
              {/* Cities */}
              {panel(t.anCities, <div className="space-y-2">{cityAgg.map(([n, v]) => barRow(n, v, cityAgg[0]?.[1] || 1, 'bg-amber-500'))}</div>, cityAgg.length === 0)}
              {/* Referrers */}
              {panel(t.anReferrers, <div className="space-y-2">{refAgg.map(([n, v]) => barRow(n === 'direct' ? t.anDirect : n, v, refAgg[0]?.[1] || 1, 'bg-rose-500'))}</div>, refAgg.length === 0)}
            </div>

            {/* 14-day trend */}
            <div className={card + ' p-4'}>
              <h4 className="text-sm font-bold text-gray-700 mb-3">{t.anTrend}</h4>
              <div className="flex items-end gap-1.5 h-28">
                {trend.map(d => (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex items-end justify-center flex-1">
                      <div className="w-full bg-sky-500/80 group-hover:bg-sky-600 rounded-t transition-colors" style={{ height: `${(d.count / maxTrend) * 100}%`, minHeight: d.count ? 4 : 0 }} title={`${d.count}`} />
                    </div>
                    <span className="text-[9px] text-gray-400" dir="ltr">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════ EDITOR ════════════
  if (!draft) return null;
  const isServices = draft.type === 'services';
  const isRealEstate = draft.type === 'realestate';
  return (
    <div className="space-y-5 animate-fade-in pb-10">
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-gray-50/80 backdrop-blur z-10 py-2">
        <button onClick={() => { setMode('list'); setDraft(null); }} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <div className="flex items-center gap-2">
          <a href={draft.slug ? shopUrl(draft) : undefined} target="_blank" rel="noreferrer" className={`text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1 ${!draft.slug ? 'opacity-40 pointer-events-none' : ''}`}><IconGlobe className="w-3.5 h-3.5" />{t.open}</a>
          <button onClick={() => setEmbedShop(draft)} disabled={!draft.slug} title={t.gsiteTitle} className={`text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 ${!draft.slug ? 'opacity-40 pointer-events-none' : ''}`}><IconGlobe className="w-3.5 h-3.5" />{t.gsite}</button>
          <a href={draft.slug ? catalogUrl(draft) : undefined} target="_blank" rel="noreferrer" title={t.catalogTitle} className={`text-xs px-3 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1 ${!draft.slug ? 'opacity-40 pointer-events-none' : ''}`}>📄 {t.catalog}</a>
          <button onClick={() => downloadShopJson(draft)} title={t.downloadJson} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">⤓ JSON</button>
          {!readonly && <button onClick={() => triggerUpdate(draft)} title={t.updateJson} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50">⤒ JSON</button>}
          {!readonly && <button onClick={save} disabled={saving || productsLoading || productsSyncing} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"><IconCheck className="w-4 h-4" />{t.save}</button>}
        </div>
      </div>

      {productsLoadFailed && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm px-4 py-3 space-y-2">
          <p className="font-bold">{T ? '⚠ محصولات بارگذاری نشدند' : '⚠ Products failed to load'}</p>
          <p className="text-xs text-rose-800">{T ? 'chunk محصول روی سرور نیست. ذخیره نکنید — ابتدا «↺ بازیابی» را بزنید یا JSON کامل import کنید.' : 'Product chunks are missing on the server. Do not save — use Recover or import full JSON first.'}</p>
          {!readonly && (
            <button type="button" onClick={() => recoverShopProducts(draft)} disabled={recoveringShopId === draft.id} className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
              {recoveringShopId === draft.id ? '…' : (T ? '↺ بازیابی محصولات' : '↺ Recover products')}
            </button>
          )}
        </div>
      )}

      {productsLoading && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm px-4 py-3">
          {T ? 'در حال بارگذاری محصولات…' : 'Loading products…'}
        </div>
      )}
      {productsSyncing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          {T
            ? `در حال بارگذاری بقیه محصولات… (${draft.products.length}${draft.productCount ? ` / ${draft.productCount}` : ''})`
            : `Loading remaining products… (${draft.products.length}${draft.productCount ? ` / ${draft.productCount}` : ''})`}
        </div>
      )}

      {showAllOrders && !readonly && (
        <MetaShopBackupPanel
          shop={draft}
          T={T}
          actorName={backupActorName}
          productsReady={productsFullyLoaded && !shopNeedsProductHydration(draft)}
          productsLoading={productsLoading || productsSyncing}
          onDraftReplace={setDraft}
          onSaveShop={async s => {
            await onSaveMetaShop({ ...s, isActive: s.isActive !== false });
          }}
        />
      )}

      {/* Basics */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><IconSettings className="w-4 h-4 text-indigo-500" />{t.basics}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>{t.name}</label><input className={fld} value={draft.name} onChange={e => upd({ name: e.target.value, slug: draft.slug || slugify(e.target.value) })} /></div>
          <div><label className={lbl}>{t.slug}</label><input className={fld + ' dir-ltr'} value={draft.slug} onChange={e => upd({ slug: slugify(e.target.value) })} placeholder="my-shop" /></div>
          <div><label className={lbl}>{t.code}</label>
            <div className="flex gap-2">
              <input className={fld + ' dir-ltr font-mono font-bold tracking-widest uppercase'} maxLength={4} value={draft.code || ''} onChange={e => upd({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })} placeholder={shopCodeOf(draft)} />
              <button type="button" onClick={() => upd({ code: uniqueShopCode(metaShops.filter(s => s.id !== draft.id)) })} className="px-3 py-2 rounded-lg border border-gray-300 text-xs whitespace-nowrap hover:bg-gray-50">{t.regen}</button>
            </div>
          </div>
          <div><label className={lbl}>{t.type}</label><select className={fld + ' bg-white'} value={draft.type} onChange={e => upd({ type: e.target.value as MetaShopType })}><option value="products">{t.typeProducts}</option><option value="services">{t.typeServices}</option><option value="realestate">{t.typeRealEstate}</option></select></div>
          <div className="md:col-span-2 border border-slate-100 rounded-xl p-4 bg-slate-50/50">
            <MetaShopCurrencyRatesEditor
              baseCurrency={draft.currency || 'USD'}
              baseCurrencyLabel={draft.currencyLabel}
              baseCurrencyLabelEn={draft.currencyLabelEn}
              displayCurrencies={draft.displayCurrencies || []}
              defaultDisplayCurrency={draft.defaultDisplayCurrency}
              lang={lang}
              onBaseChange={code => {
                const normalized = normalizeDisplayCurrencies(code, draft.displayCurrencies);
                upd({
                  currency: code,
                  displayCurrencies: normalized,
                  defaultDisplayCurrency: normalizeDefaultDisplayCurrency(code, normalized, draft.defaultDisplayCurrency),
                });
              }}
              onBaseLabelsChange={patch => upd(patch)}
              onDisplayCurrenciesChange={list => upd({
                displayCurrencies: list,
                defaultDisplayCurrency: normalizeDefaultDisplayCurrency(draft.currency || 'USD', list, draft.defaultDisplayCurrency),
              })}
              onDefaultDisplayCurrencyChange={code => upd({ defaultDisplayCurrency: code })}
            />
          </div>
          <div><label className={lbl}>{t.defLang}</label><select className={fld + ' bg-white'} value={draft.defaultLang || langOptions()[0].code} onChange={e => upd({ defaultLang: e.target.value })}>{langOptions().map(l => <option key={l.code} value={l.code}>{l.name || l.code}</option>)}</select></div>
          <div className="md:col-span-2">
            <label className={lbl}>{t.productsTabLabel}</label>
            <input className={fld} value={productsTabLangField('fa')} onChange={e => setProductsTabLangField('fa', e.target.value)} placeholder={productsTabPlaceholder('fa')} />
          </div>
          {pageEditorLangs().length > 0 && (
            <div className="md:col-span-2 p-3 rounded-xl bg-sky-50/60 border border-sky-100">
              <h5 className="text-sm font-bold text-gray-700 mb-1">{t.productsTabI18n}</h5>
              <p className="text-xs text-gray-500 mb-3">{t.productsTabI18nHint}</p>
              <div className="space-y-3">
                {pageEditorLangs().map(lg => (
                  <div key={lg.code}>
                    <label className={lbl}>{lg.name || lg.code}</label>
                    <input className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={productsTabLangField(lg.code)} onChange={e => setProductsTabLangField(lg.code, e.target.value)} placeholder={productsTabPlaceholder(lg.code)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h5 className="text-sm font-bold text-gray-700 mb-1">{t.dirT}</h5>
          <p className="text-xs text-gray-500 mb-3">{t.dirHint}</p>
          <div>
            <label className={lbl}>{t.dirCat} <span className="text-gray-400 font-normal">{t.dirCatMulti}</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {dirCats().map((c, i) => <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-1 text-xs font-medium">{(c.fa || '—')} <span className="text-indigo-300">/</span> {(c.en || '—')}<button onClick={() => removeDirCat(i)} className="text-indigo-400 hover:text-red-500 ml-1">✕</button></span>)}
              {dirCats().length === 0 && <span className="text-xs text-gray-400">{T ? 'هنوز دسته‌ای اضافه نشده.' : 'No categories yet.'}</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <input className={fld + ' flex-1 min-w-[120px]'} value={dirCatFa} onChange={e => setDirCatFa(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDirCat(); } }} placeholder={T ? 'دسته (فارسی)' : 'Category (FA)'} list="msd-dir-cats-fa" />
              <input className={fld + ' flex-1 min-w-[120px] dir-ltr'} value={dirCatEn} onChange={e => setDirCatEn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDirCat(); } }} placeholder={T ? 'دسته (انگلیسی)' : 'Category (EN)'} list="msd-dir-cats-en" />
              <button onClick={addDirCat} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">{T ? 'افزودن' : 'Add'}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div><label className={lbl}>{t.dirSub} ({T ? 'فارسی' : 'FA'})</label><input className={fld} value={draft.directorySub?.fa ?? draft.directorySubcategory ?? ''} onChange={e => upd({ directorySub: { ...(draft.directorySub || {}), fa: e.target.value }, directorySubcategory: e.target.value })} placeholder={T ? 'مثلا: زعفران' : 'e.g. زعفران'} /></div>
            <div><label className={lbl}>{t.dirSub} ({T ? 'انگلیسی' : 'EN'})</label><input className={fld + ' dir-ltr'} value={draft.directorySub?.en ?? ''} onChange={e => upd({ directorySub: { ...(draft.directorySub || {}), en: e.target.value } })} placeholder="e.g. Saffron" /></div>
            <div><label className={lbl}>{t.shopNo}</label><input className={fld + ' dir-ltr'} value={draft.shopNumber || ''} onChange={e => upd({ shopNumber: e.target.value })} placeholder={T ? 'مثلا: 12' : 'e.g. 12'} /></div>
          </div>
          <datalist id="msd-dir-cats-fa">{Array.from(new Set(metaShops.flatMap(s => [...(s.directoryCats || []).map(c => c.fa), ...(s.directoryCategories || []), s.directoryCategory]).filter(Boolean))).map(c => <option key={c} value={c as string} />)}</datalist>
          <datalist id="msd-dir-cats-en">{Array.from(new Set(metaShops.flatMap(s => (s.directoryCats || []).map(c => c.en)).filter(Boolean))).map(c => <option key={c} value={c as string} />)}</datalist>
        </div>

        {/* Languages */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="flex items-center justify-between mb-1">
            <h5 className="text-sm font-bold text-gray-700">{t.langsT}</h5>
            <button onClick={addLang} className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addLang}</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">{t.langsHint}</p>
          <div className="flex flex-wrap gap-2">
            {shopLangs().length === 0 && <span className="text-xs text-gray-400">fa، en {T ? '(پیش‌فرض)' : '(default)'}</span>}
            {shopLangs().map((lg, idx) => (
              <div key={idx} className="flex items-center gap-1 border border-gray-200 rounded-lg p-1.5 bg-gray-50/60">
                <input className="w-12 px-1.5 py-1 rounded border border-gray-200 text-xs outline-none dir-ltr text-center" placeholder={t.langCode} value={lg.code} onChange={e => updLang(idx, { code: e.target.value.trim().toLowerCase() })} />
                <input className="w-24 px-1.5 py-1 rounded border border-gray-200 text-xs outline-none" placeholder={t.langName} value={lg.name} onChange={e => updLang(idx, { name: e.target.value })} />
                <label className="flex items-center gap-1 text-[10px] text-gray-500"><input type="checkbox" className="accent-indigo-600" checked={!!lg.rtl} onChange={e => updLang(idx, { rtl: e.target.checked })} />{t.langRtl}</label>
                <button onClick={() => removeLang(idx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-gray-700"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={draft.isActive !== false} onChange={e => upd({ isActive: e.target.checked })} />{t.active}</label>
        {draft.type === 'products' && (
          <div className="mt-4 p-3 rounded-xl border border-violet-100 bg-violet-50/50">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="w-4 h-4 accent-violet-600" checked={!!draft.supplierCollaborationEnabled} onChange={e => upd({ supplierCollaborationEnabled: e.target.checked })} />{t.supplierCollabEnable}</label>
            <p className="text-xs text-gray-500 mt-1.5">{t.supplierCollabHint}</p>
          </div>
        )}
        <div className="mt-4">
          <label className={lbl}>{t.searchKeywords}</label>
          <textarea
            className={fld + ' min-h-[72px]'}
            value={formatSearchKeywordsForInput(draft.searchKeywords)}
            onChange={e => upd({ searchKeywords: parseSearchKeywords(e.target.value) })}
            placeholder={T ? 'مثلا: زعفران، pistachio، saffron export' : 'e.g. saffron, pistachio, dried fruit'}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t.searchKeywordsHint}</p>
        </div>
      </div>

      {/* Theme */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-4">{t.theme}</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([['primary', t.primary], ['cover', t.coverC], ['coverText', t.coverText], ['bg', t.bg]] as const).map(([k, label]) => (
            <div key={k}><label className={lbl}>{label}</label><div className="flex items-center gap-2"><input type="color" value={(draft.theme as any)[k]} onChange={e => updTheme({ [k]: e.target.value } as any)} className="w-10 h-9 rounded border border-gray-300 cursor-pointer" /><input className={fld + ' dir-ltr'} value={(draft.theme as any)[k]} onChange={e => updTheme({ [k]: e.target.value } as any)} /></div></div>
          ))}
        </div>
      </div>

      {/* Cover */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-4">{t.cover}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>{t.collection}</label><input className={fld} value={draft.collectionText || ''} onChange={e => upd({ collectionText: e.target.value })} /></div>
          <div><label className={lbl}>{t.heroTitle}</label><input className={fld} value={draft.title || ''} onChange={e => upd({ title: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.heroSub}</label><input className={fld} value={draft.subtitle || ''} onChange={e => upd({ subtitle: e.target.value })} /></div>
          {pageEditorLangs().length > 0 && (
            <div className="md:col-span-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <h5 className="text-sm font-bold text-gray-700 mb-1">{t.coverI18n}</h5>
              <p className="text-xs text-gray-500 mb-3">{t.coverI18nHint}</p>
              <div className="space-y-4">
                {pageEditorLangs().map(lg => (
                  <div key={lg.code} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-white/80 border border-emerald-100/80">
                    <div className="md:col-span-2 text-xs font-bold text-emerald-800">{lg.name || lg.code}</div>
                    <div><label className={lbl}>{t.collection}</label><input className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={coverLangField(lg.code, 'collectionText')} onChange={e => setCoverLangField(lg.code, 'collectionText', e.target.value)} /></div>
                    <div><label className={lbl}>{t.heroTitle}</label><input className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={coverLangField(lg.code, 'title')} onChange={e => setCoverLangField(lg.code, 'title', e.target.value)} /></div>
                    <div className="md:col-span-2"><label className={lbl}>{t.heroSub}</label><input className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={coverLangField(lg.code, 'subtitle')} onChange={e => setCoverLangField(lg.code, 'subtitle', e.target.value)} /></div>
                    <div><label className={lbl}>{t.cartBtn}</label><input className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={coverLangField(lg.code, 'cartButtonText')} onChange={e => setCoverLangField(lg.code, 'cartButtonText', e.target.value)} /></div>
                    <div className="md:col-span-2"><label className={lbl}>{t.thanksTxt}</label><textarea rows={2} className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={coverLangField(lg.code, 'orderThankYouText')} onChange={e => setCoverLangField(lg.code, 'orderThankYouText', e.target.value)} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div><label className={lbl}>{t.coverImg}</label>
            <div className="flex items-center gap-2 mb-2">
              {draft.coverImage && <img src={draft.coverImage} className="w-14 h-10 object-cover rounded border" />}
              <button onClick={() => coverInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex items-center gap-1"><IconUpload className="w-4 h-4" />{t.upload}</button>
              {draft.coverImage && <button onClick={() => upd({ coverImage: '' })} className="text-red-400"><IconTrash className="w-4 h-4" /></button>}
              <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ coverImage: url })); }} />
            </div>
            <input className={fld + ' dir-ltr text-xs'} placeholder={t.orLink} value={draft.coverImage || ''} onChange={e => upd({ coverImage: e.target.value })} />
          </div>
          <div><label className={lbl}>{t.logo}</label>
            <div className="flex items-center gap-2 mb-2">
              {draft.logo && <img src={draft.logo} className="w-10 h-10 object-contain rounded border" />}
              <button onClick={() => logoInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex items-center gap-1"><IconUpload className="w-4 h-4" />{t.upload}</button>
              {draft.logo && <button onClick={() => upd({ logo: '' })} className="text-red-400"><IconTrash className="w-4 h-4" /></button>}
              <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ logo: url })); }} />
            </div>
            <input className={fld + ' dir-ltr text-xs'} placeholder={t.orLink} value={draft.logo || ''} onChange={e => upd({ logo: e.target.value })} />
          </div>
          <div><label className={lbl}>{t.cartBtn}</label><input className={fld} value={draft.cartButtonText || ''} onChange={e => upd({ cartButtonText: e.target.value })} placeholder={isRealEstate ? (T ? 'درخواست بازدید' : 'Request viewing') : isServices ? (T ? 'ثبت درخواست' : 'Request') : (T ? 'ثبت سفارش' : 'Place Order')} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.thanksTxt}</label><textarea rows={2} className={fld} value={draft.orderThankYouText || ''} onChange={e => upd({ orderThankYouText: e.target.value })} /></div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={draft.showInvoiceHint !== false} onChange={e => upd({ showInvoiceHint: e.target.checked })} />
              {t.invoiceHintShow}
            </label>
            <p className="text-[11px] text-gray-400 mb-2">{t.invoiceHintShowHint}</p>
            {draft.showInvoiceHint !== false && (
              <>
                <label className={lbl}>{t.invoiceHint}</label>
                <textarea rows={2} className={fld} value={invoiceHintLangField('fa')} onChange={e => setInvoiceHintLangField('fa', e.target.value)} placeholder={defaultInvoiceHintPh} />
                <p className="text-[11px] text-gray-400 mt-1">{t.invoiceHintHint}</p>
              </>
            )}
          </div>
          {draft.showInvoiceHint !== false && pageEditorLangs().length > 0 && (
            <div className="md:col-span-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <h5 className="text-sm font-bold text-gray-700 mb-2">{t.invoiceHintI18n}</h5>
              <div className="space-y-3">
                {pageEditorLangs().map(lg => (
                  <div key={lg.code}>
                    <label className={lbl}>{lg.name || lg.code}</label>
                    <textarea rows={2} className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} value={invoiceHintLangField(lg.code)} onChange={e => setInvoiceHintLangField(lg.code, e.target.value)} placeholder={lg.code === 'en' ? 'This is a proforma preview; the final amount is confirmed after review.' : defaultInvoiceHintPh} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storefront banner (bazaar lists) — optional */}
          <div><label className={lbl}>{t.sfTagFa}</label><input className={fld} value={draft.storefrontTagline || ''} onChange={e => upd({ storefrontTagline: e.target.value })} placeholder={T ? 'مثلا: 🔥 جدید / تخفیف ویژه' : 'e.g. 🔥 New / Special offer'} /></div>
          <div><label className={lbl}>{t.sfTagEn}</label><input className={fld + ' dir-ltr'} value={draft.storefrontTaglineEn || ''} onChange={e => upd({ storefrontTaglineEn: e.target.value })} placeholder="e.g. 🔥 New" /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.sfColor} <span className="text-gray-400 font-normal">{t.sfColorHint}</span></label>
            <div className="flex items-center gap-2">
              <input type="color" value={draft.storefrontColor || draft.theme?.cover || '#2d4a1a'} onChange={e => upd({ storefrontColor: e.target.value })} className="w-10 h-9 rounded border border-gray-300 cursor-pointer" />
              <input className={fld + ' dir-ltr flex-1'} value={draft.storefrontColor || ''} onChange={e => upd({ storefrontColor: e.target.value })} placeholder={draft.theme?.cover || '#2d4a1a'} />
              {draft.storefrontColor && <button type="button" onClick={() => upd({ storefrontColor: '' })} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 whitespace-nowrap">{t.sfClear}</button>}
            </div>
          </div>
        </div>
      </div>

      {/* SEO / link sharing */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-1 flex items-center gap-2"><IconLink className="w-4 h-4 text-sky-500" />{t.seoT}</h4>
        <p className="text-xs text-gray-500 mb-4">{t.seoHint}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>{t.seoTitle}</label><input className={fld} value={draft.seoTitle || ''} onChange={e => upd({ seoTitle: e.target.value })} placeholder={draft.name || t.seoTitlePh} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.seoDesc}</label><textarea rows={2} className={fld} value={draft.seoDescription || ''} onChange={e => upd({ seoDescription: e.target.value })} placeholder={draft.collectionText || draft.subtitle || t.seoDescPh} /></div>
          <div className="md:col-span-2">
            <label className={lbl}>{t.seoImage}</label>
            <div className="flex items-center gap-2 mb-2">
              {(draft.seoImage || draft.logo) && <img src={draft.seoImage || draft.logo} className="w-12 h-12 object-contain rounded border bg-white" alt="" />}
              <button type="button" onClick={() => seoImageInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex items-center gap-1"><IconUpload className="w-4 h-4" />{t.upload}</button>
              {draft.seoImage && <button type="button" onClick={() => upd({ seoImage: '' })} className="text-red-400"><IconTrash className="w-4 h-4" /></button>}
              {!draft.seoImage && draft.logo && <button type="button" onClick={() => upd({ seoImage: draft.logo })} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{T ? 'استفاده از لوگو' : 'Use logo'}</button>}
              <input type="file" ref={seoImageInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ seoImage: url })); }} />
            </div>
            <input className={fld + ' dir-ltr text-xs'} placeholder={t.orLink} value={draft.seoImage || ''} onChange={e => upd({ seoImage: e.target.value })} />
            <p className="text-[11px] text-gray-400 mt-1">{t.seoImageHint}</p>
          </div>
        </div>
        {shopLangs().length > 0 && (
          <div className="border-t border-gray-100 mt-4 pt-4">
            <h5 className="text-sm font-bold text-gray-700 mb-1">{t.seoI18n}</h5>
            <p className="text-xs text-gray-500 mb-3">{t.seoI18nHint}</p>
            <div className="space-y-3">
              {shopLangs().map(lg => (
                <div key={lg.code} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="md:col-span-2 text-xs font-bold text-sky-700">{lg.name || lg.code}</div>
                  <div><label className={lbl}>{t.seoTitle}</label><input className={fld} value={draft.i18n?.[lg.code]?.seoTitle || ''} onChange={e => updShopI18n(lg.code, 'seoTitle', e.target.value)} /></div>
                  <div className="md:col-span-2"><label className={lbl}>{t.seoDesc}</label><textarea rows={2} className={fld} value={draft.i18n?.[lg.code]?.seoDescription || ''} onChange={e => updShopI18n(lg.code, 'seoDescription', e.target.value)} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {draft.slug && (
          <div className="mt-4 p-3 rounded-xl border border-sky-100 bg-sky-50/50">
            <div className="text-xs font-bold text-gray-600 mb-2">{t.seoPreview}</div>
            {(() => {
              const preview = metaFromMetaShop(draft, shopBaseUrl.replace(/\?.*$/, '').replace(/\/$/, '') || 'https://www.tohiddayhami.com');
              return (
                <div className="flex gap-3 items-start">
                  {preview.image && <img src={preview.image} className="w-16 h-16 rounded-lg object-cover border bg-white shrink-0" alt="" />}
                  <div className="min-w-0">
                    <div className="font-bold text-gray-800 text-sm truncate">{preview.title}</div>
                    {preview.description && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{preview.description}</div>}
                    <div className="text-[10px] text-gray-400 mt-1 dir-ltr truncate">{shopUrl(draft)}</div>
                  </div>
                </div>
              );
            })()}
            <p className="text-[10px] text-gray-400 mt-2">{t.seoRefreshHint}</p>
          </div>
        )}
      </div>

      {/* Marketing — Floating Promotions */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-1 flex items-center gap-2">
          <IconTag className="w-4 h-4 text-fuchsia-500" />
          {T ? 'بازاریابی → استیکرهای تبلیغاتی' : 'Marketing → Floating Promotions'}
        </h4>
        <p className="text-xs text-gray-500 mb-4">{t.fpsHint}</p>
        <MetaShopFloatingPromosEditor
          shop={draft}
          stickers={draft.floatingStickers || []}
          onChange={stickers => upd({ floatingStickers: stickers.length ? stickers : undefined })}
          uploadImage={uploadImg}
          T={T}
          fld={fld}
          lbl={lbl}
        />
      </div>

      {/* Contact */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-4">{t.contact}</h4>
        {isRealEstate && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{t.contactReHint}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>{t.phone}</label><input className={fld + ' dir-ltr'} value={draft.phone || ''} onChange={e => upd({ phone: e.target.value })} placeholder="+968 …" /></div>
          <div><label className={lbl}>{t.whatsapp}</label><input className={fld + ' dir-ltr'} value={draft.whatsapp || ''} onChange={e => upd({ whatsapp: e.target.value })} placeholder="+968 …" /><p className="text-[10px] text-gray-400 mt-0.5">{t.whatsappHint}</p></div>
          <div><label className={lbl}>{t.email}</label><input className={fld + ' dir-ltr'} value={draft.email || ''} onChange={e => upd({ email: e.target.value })} /></div>
          <div><label className={lbl}>{t.website}</label><input className={fld + ' dir-ltr'} value={draft.website || ''} onChange={e => upd({ website: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.address}</label><input className={fld} value={draft.address || ''} onChange={e => upd({ address: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.footer}</label><input className={fld} value={draft.footerText || ''} onChange={e => upd({ footerText: e.target.value })} /></div>
        </div>
        {shopLangs().length > 0 && (
          <div className="border-t border-gray-100 mt-4 pt-4">
            <h5 className="text-sm font-bold text-gray-700 mb-1">{t.footerI18n}</h5>
            <p className="text-xs text-gray-500 mb-3">{t.footerI18nHint}</p>
            <div className="space-y-3">
              {shopLangs().map(lg => (
                <div key={lg.code} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="md:col-span-2 text-xs font-bold text-indigo-700">{lg.name || lg.code}</div>
                  <div className="md:col-span-2"><label className={lbl}>{t.footer}</label><input className={fld} value={draft.i18n?.[lg.code]?.footerText || ''} onChange={e => updShopI18n(lg.code, 'footerText', e.target.value)} /></div>
                  <div className="md:col-span-2"><label className={lbl}>{t.address}</label><input className={fld} value={draft.i18n?.[lg.code]?.address || ''} onChange={e => updShopI18n(lg.code, 'address', e.target.value)} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Routing */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-1 flex items-center gap-2"><IconUsers className="w-4 h-4 text-indigo-500" />{t.routing}</h4>
        <p className="text-xs text-gray-500 mb-4">{t.routeHint}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {([['', t.routeNone], ['personnel', t.routePersonnel], ['department', t.routeDept]] as const).map(([v, label]) => (
            <button key={v} onClick={() => upd({ assignType: (v || undefined) as any })} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${(draft.assignType || '') === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>{label}</button>
          ))}
        </div>
        {draft.assignType === 'personnel' && (
          <div className="flex flex-wrap gap-2">
            {personnel.map(p => { const on = (draft.assignedPersonnelIds || []).includes(p.id); return (
              <button key={p.id} onClick={() => upd({ assignedPersonnelIds: on ? (draft.assignedPersonnelIds || []).filter(id => id !== p.id) : [...(draft.assignedPersonnelIds || []), p.id] })} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200'}`}>{p.fullName}</button>
            ); })}
          </div>
        )}
        {draft.assignType === 'department' && (
          <select className={fld + ' bg-white max-w-xs'} value={draft.assignedDepartmentId || ''} onChange={e => upd({ assignedDepartmentId: e.target.value })}>
            <option value="">{T ? '— انتخاب دپارتمان —' : '— Select department —'}</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      {/* Panel edit access */}
      {!readonly && (
        <div className={card}>
          <h4 className="font-bold text-gray-700 mb-1 flex items-center gap-2"><IconUsers className="w-4 h-4 text-cyan-500" />{t.editorAccess}</h4>
          <p className="text-xs text-gray-500 mb-4">{t.editorAccessHint}</p>
          <div className="flex flex-wrap gap-2">
            {personnel.filter(p => p.status !== 'inactive').map(p => {
              const on = (draft.editorPersonnelIds || []).includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => upd({ editorPersonnelIds: on ? (draft.editorPersonnelIds || []).filter(id => id !== p.id) : [...(draft.editorPersonnelIds || []), p.id] })} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-600 border-gray-200'}`}>{p.fullName}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Default checkout fees — not used for real-estate shops */}
      {!isRealEstate && (
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold text-gray-700">{t.feesT} <span className="text-xs text-gray-400">({fees().length})</span></h4>
          <button onClick={addFee} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addFee}</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t.feesHint}</p>

        {fees().length === 0 ? <p className="text-sm text-gray-400 text-center py-3">{t.noFees}</p> : (
          <div className="space-y-3">
            {fees().map((f, idx) => (
              <div key={f.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input className={fld + ' flex-1 min-w-[120px]'} placeholder={t.feeLabel} value={f.label} onChange={e => updFee(idx, { label: e.target.value })} />
                  <input className={fld + ' flex-1 min-w-[120px] dir-ltr'} placeholder={t.feeLabelEn} value={f.labelEn || ''} onChange={e => updFee(idx, { labelEn: e.target.value })} />
                  <input className={fld + ' w-24'} type="number" step="any" placeholder={t.feeAmount} value={f.amount ?? ''} onChange={e => updFee(idx, { amount: parseFloat(e.target.value) || 0 })} />
                  <select className={fld + ' w-24 bg-white dir-ltr'} value={(f.currency || draft.currency || 'OMR').trim().toUpperCase()} onChange={e => updFee(idx, { currency: e.target.value.toUpperCase() })}>
                    {feeCurrencyOptions().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" className="accent-indigo-600" checked={!!f.required} onChange={e => updFee(idx, { required: e.target.checked })} />{t.feeRequired}</label>
                  <label className={`flex items-center gap-1 text-xs text-gray-600 ${f.required ? 'opacity-40 pointer-events-none' : ''}`}><input type="checkbox" className="accent-indigo-600" checked={!!f.defaultOn} onChange={e => updFee(idx, { defaultOn: e.target.checked })} />{t.feeDefaultOn}</label>
                  <button onClick={() => removeFee(idx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div><label className={lbl}>{t.feeDesc}</label><textarea rows={2} className={fld} value={f.description || ''} onChange={e => updFee(idx, { description: e.target.value })} placeholder={t.feeDescPh} /></div>
                  <div><label className={lbl}>{t.feeDescEn}</label><textarea rows={2} className={fld + ' dir-ltr'} value={f.descriptionEn || ''} onChange={e => updFee(idx, { descriptionEn: e.target.value })} placeholder={t.feeDescPh} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tax (VAT) */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-1">{t.taxT}</h4>
          <p className="text-xs text-gray-500 mb-3">{t.taxHint}</p>
          <label className="flex items-center gap-2 mb-3 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-indigo-600 rounded"
              checked={draft.taxEnabled !== false}
              onChange={e => upd({ taxEnabled: e.target.checked })}
            />
            <span>{t.taxEnabled}</span>
          </label>
          <div className={`grid grid-cols-1 md:grid-cols-4 gap-3 items-end transition-opacity ${draft.taxEnabled !== false ? '' : 'opacity-50 pointer-events-none'}`}>
            <div><label className={lbl}>{t.taxRate}</label><input className={fld} type="number" value={draft.taxRate ?? ''} onChange={e => upd({ taxRate: parseFloat(e.target.value) || 0 })} placeholder="0" /></div>
            <div><label className={lbl}>{t.taxMode}</label><select className={fld + ' bg-white'} value={draft.taxInclusive ? 'incl' : 'excl'} onChange={e => upd({ taxInclusive: e.target.value === 'incl' })}><option value="excl">{t.taxExcl}</option><option value="incl">{t.taxIncl}</option></select></div>
            <div><label className={lbl}>{t.taxLabelF}</label><input className={fld} value={draft.taxLabel || ''} onChange={e => upd({ taxLabel: e.target.value })} placeholder={T ? 'مالیات بر ارزش افزوده' : ''} /></div>
            <div><label className={lbl}>{t.taxLabelEnF}</label><input className={fld + ' dir-ltr'} value={draft.taxLabelEn || ''} onChange={e => upd({ taxLabelEn: e.target.value })} placeholder="VAT" /></div>
          </div>
        </div>
      </div>
      )}

      {/* Discount codes */}
      {!isRealEstate && (
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold text-gray-700">{t.discT} <span className="text-xs text-gray-400">({discounts().length})</span></h4>
          <button onClick={addDiscount} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addDisc}</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t.discHint}</p>
        {discounts().length === 0 ? <p className="text-sm text-gray-400 text-center py-3">{t.noDisc}</p> : (
          <div className="space-y-3">
            {discounts().map((d, idx) => (
              <div key={d.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-stretch">
                    <input className={fld + ' dir-ltr rounded-e-none uppercase font-bold w-36'} placeholder={t.discCode} value={d.code} onChange={e => updDiscount(idx, { code: e.target.value.toUpperCase() })} />
                    <button onClick={() => updDiscount(idx, { code: genCode() })} className="px-2 rounded-s-none rounded-lg border border-s-0 border-gray-300 bg-gray-50 hover:bg-gray-100 text-[11px] text-gray-600 whitespace-nowrap" title={t.gen}>{t.gen}</button>
                  </div>
                  <select className={fld + ' bg-white w-auto'} value={d.type} onChange={e => updDiscount(idx, { type: e.target.value as any })}>
                    <option value="percent">{t.discTypePercent}</option><option value="fixed">{t.discTypeFixed}</option>
                  </select>
                  <input className={fld + ' w-24'} type="number" placeholder={t.discValue} value={d.value ?? ''} onChange={e => updDiscount(idx, { value: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-gray-400">{d.type === 'percent' ? '٪' : draft.currency}</span>
                  <label className="flex items-center gap-1 text-xs text-gray-600 ms-auto"><input type="checkbox" className="accent-indigo-600" checked={d.active !== false} onChange={e => updDiscount(idx, { active: e.target.checked })} />{t.active}</label>
                  <button onClick={() => removeDiscount(idx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">{t.discScope}:</span>
                  <select className={fld + ' bg-white w-auto'} value={d.scope} onChange={e => updDiscount(idx, { scope: e.target.value as any })}>
                    <option value="all">{t.scopeAll}</option><option value="products">{t.scopeProducts}</option><option value="categories">{t.scopeCats}</option>
                  </select>
                  <input className={fld + ' w-40'} type="number" placeholder={t.discMin} value={d.minOrder ?? ''} onChange={e => updDiscount(idx, { minOrder: parseFloat(e.target.value) || undefined })} />
                </div>
                {d.scope === 'products' && (
                  <div><p className="text-[11px] text-gray-500 mb-1">{t.selectProducts}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {draft.products.map(p => { const on = (d.productIds || []).includes(p.id); return (
                        <button key={p.id} onClick={() => updDiscount(idx, { productIds: on ? (d.productIds || []).filter(id => id !== p.id) : [...(d.productIds || []), p.id] })} className={`px-2 py-1 rounded-full text-[11px] border ${on ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200'}`}>{p.name || p.sku || '—'}</button>
                      ); })}
                    </div>
                  </div>
                )}
                {d.scope === 'categories' && (
                  <div><p className="text-[11px] text-gray-500 mb-1">{t.selectCats}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {draftCategories().length === 0 ? <span className="text-[11px] text-gray-400">—</span> : draftCategories().map(cat => { const on = (d.categories || []).includes(cat); return (
                        <button key={cat} onClick={() => updDiscount(idx, { categories: on ? (d.categories || []).filter(c => c !== cat) : [...(d.categories || []), cat] })} className={`px-2 py-1 rounded-full text-[11px] border ${on ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200'}`}>{cat}</button>
                      ); })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Products */}
      <div className={card}>
        <datalist id={`ms-cats-${draft.id}`}>
          {draftProductGroups.map(g => <option key={g} value={g} />)}
        </datalist>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-gray-700">{isRealEstate ? (T ? 'املاک / آگهی‌ها' : 'Properties / Listings') : t.productsT} <span className="text-xs text-gray-400">({draft.products.length})</span></h4>
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setImportText(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{t.importJson}</button>
            <button onClick={addProduct} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addProduct}</button>
          </div>
        </div>
        {!isRealEstate && (
        <label className="flex items-start gap-2 mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer" title={t.hideAllPricesTip}>
          <input type="checkbox" className="accent-emerald-600 mt-0.5" checked={!!draft.hidePrices} onChange={e => setDraft(d => d ? { ...d, hidePrices: e.target.checked } : d)} />
          <span><span className="text-xs font-bold text-emerald-700">{t.hideAllPrices}</span><span className="block text-[11px] text-emerald-600/80">{t.hideAllPricesTip}</span></span>
        </label>
        )}
        {!isRealEstate && (
        <div className="mb-3 px-1 space-y-2" title={t.priceLabelTip}>
          <span className="text-[11px] font-medium text-gray-500 shrink-0">{t.priceLabel}:</span>
          {shopLangs().length > 0 ? (
            <>
              <p className="text-[10px] text-gray-400">{t.priceLabelI18n}</p>
              {shopLangs().filter(l => l.code).map(lg => (
                <div key={lg.code} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 w-20 shrink-0">{lg.name || lg.code}</span>
                  {lg.code === 'fa' ? (
                    <select className={fld + ' flex-1'} value={draft.hidePriceText || ''} onChange={e => setDraft(d => d ? { ...d, hidePriceText: e.target.value || undefined } : d)}>
                      <option value="">{t.priceLabelDefault}</option>
                      <option value={t.priceLabelContact}>{t.priceLabelContact}</option>
                    </select>
                  ) : lg.code === 'en' ? (
                    <input
                      className={fld + ' flex-1'}
                      placeholder={t.priceLabelContact}
                      value={draft.i18n?.en?.hidePriceText ?? draft.hidePriceText ?? ''}
                      onChange={e => updShopI18n('en', 'hidePriceText', e.target.value)}
                    />
                  ) : (
                    <input
                      className={fld + ' flex-1'}
                      placeholder={t.priceLabelDefault}
                      value={draft.i18n?.[lg.code]?.hidePriceText || ''}
                      onChange={e => updShopI18n(lg.code, 'hidePriceText', e.target.value)}
                    />
                  )}
                </div>
              ))}
            </>
          ) : (
            <select className={fld + ' flex-1'} value={draft.hidePriceText || ''} onChange={e => setDraft(d => d ? { ...d, hidePriceText: e.target.value || undefined } : d)}>
              <option value="">{t.priceLabelDefault}</option>
              <option value={t.priceLabelContact}>{t.priceLabelContact}</option>
            </select>
          )}
        </div>
        )}
        {!isRealEstate && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1" title={t.productImageFitTip}>
          <span className="text-[11px] font-medium text-gray-500 shrink-0">{t.productImageFit}:</span>
          <select
            className={fld + ' flex-1 min-w-[160px]'}
            value={draft.productImageFit || 'cover'}
            onChange={e => setDraft(d => d ? { ...d, productImageFit: e.target.value === 'contain' ? 'contain' : undefined } : d)}
          >
            <option value="cover">{t.imageFitCover}</option>
            <option value="contain">{t.imageFitContain}</option>
          </select>
        </div>
        )}
        {!isRealEstate && !isServices && draft.products.length > 0 && (
          <MetaShopBulkExportTermsPanel
            T={T}
            productCount={draft.products.length}
            products={draft.products}
            defaultIncoterms={draft.defaultIncoterms}
            defaultOrigin={draft.defaultOrigin}
            onProductsChange={products => setDraft(d => d ? { ...d, products } : d)}
            onDefaultsChange={patch => setDraft(d => d ? { ...d, ...patch } : d)}
          />
        )}
        {!isRealEstate && draft.products.length > 0 && (
          <MetaShopPriceHistoryPanel
            T={T}
            history={draft.priceHistory}
            onClear={!readonly ? () => setDraft(d => d ? { ...d, priceHistory: undefined } : d) : undefined}
          />
        )}
        {!isRealEstate && draft.products.length > 0 && (
          <MetaShopBulkPriceMarkupPanel
            T={T}
            markupType={draft.priceMarkupType}
            markupValue={draft.priceMarkupValue}
            productCount={draft.products.length}
            products={draft.products}
            onMarkupChange={(type, value) => setDraft(d => d ? { ...d, priceMarkupType: type, priceMarkupValue: value } : d)}
            onCommitToBasePrices={products => {
              refreshPriceBaseline(products);
              setDraft(d => d ? {
                ...d,
                products,
                priceMarkupType: undefined,
                priceMarkupValue: undefined,
              } : d);
            }}
            onPriceAction={logPriceAction}
            showStrikethroughPrice={draft.showStrikethroughPrice !== false}
            onShowStrikethroughChange={val => setDraft(d => d ? { ...d, showStrikethroughPrice: val } : d)}
            hasTemporaryShopMarkup={!!draft.priceMarkupType && (draft.priceMarkupValue ?? 0) !== 0}
            hasDriftedProducts={draft.products.some(productHasPriceDrift)}
            onClearTemporaryMarkup={() => setDraft(d => d ? { ...d, priceMarkupType: undefined, priceMarkupValue: undefined } : d)}
            onRevertAllToBase={() => {
              const products = revertAllProductsToBase(draft.products);
              refreshPriceBaseline(products);
              setDraft(d => d ? {
                ...d,
                products,
                priceMarkupType: undefined,
                priceMarkupValue: undefined,
              } : d);
            }}
          />
        )}
        {isRealEstate && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{T ? 'فروشگاه املاک سبد خرید ندارد. مشتری «درخواست بازدید» ثبت می‌کند — قیمت فقط برای نمایش است.' : 'Real-estate shops have no cart. Customers submit viewing requests — prices are display-only.'}</p>
        )}
        {draft.products.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">{t.noProducts}</p> : (
          <div className="space-y-3">
            {draft.products.slice(0, editorProductShown).map((p, idx) => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <ProductGallery images={p.images || []} onChange={imgs => updProduct(idx, { images: imgs })} lang={lang} />
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input className={fld + ' col-span-2'} placeholder={t.pName} value={p.name} onChange={e => updProduct(idx, { name: e.target.value })} />
                    <input className={fld + ' dir-ltr'} placeholder={t.pSku} value={p.sku || ''} onChange={e => updProduct(idx, { sku: e.target.value })} />
                    <input className={fld} placeholder={t.pGroup} value={p.group || ''} onChange={e => updProduct(idx, { group: e.target.value })} list={`ms-cats-${draft.id}`} />
                    <input className={fld} placeholder={t.pSubcat} value={p.subcategory || ''} onChange={e => updProduct(idx, { subcategory: e.target.value })} />
                    {(isRealEstate || isServices || !(p.priceTiers?.length)) && <input className={fld} type="number" placeholder={isRealEstate ? (T ? 'قیمت نمایشی فروش' : 'Display sale price') : t.pPrice} value={p.price ?? ''} onChange={e => { const v = parseFloat(e.target.value) || 0; updProduct(idx, { price: v, basePrice: v }); }} />}
                    <input className={fld + ' dir-ltr'} placeholder={`${t.pCurrency} (${draft.currency})`} value={p.currency || ''} onChange={e => updProduct(idx, { currency: e.target.value.toUpperCase() })} />
                    {!isServices && !isRealEstate && !(p.priceTiers?.length) && <input className={fld} type="number" placeholder={t.pPack} value={p.packPrice ?? ''} onChange={e => { const v = parseFloat(e.target.value) || 0; updProduct(idx, { packPrice: v, basePackPrice: v }); }} />}
                    {!isRealEstate && <input className={fld} placeholder={t.pUnit} value={p.unit || ''} onChange={e => updProduct(idx, { unit: e.target.value })} />}
                    {isServices ? <input className={fld + ' col-span-1'} placeholder={T ? 'مثلا: روزانه' : 'e.g. per day'} value={p.priceUnit || ''} onChange={e => updProduct(idx, { priceUnit: e.target.value })} /> : !isRealEstate && !(p.priceTiers?.length) ? <input className={fld} type="number" placeholder={t.pPackSize} value={p.pack ?? ''} onChange={e => updProduct(idx, { pack: parseFloat(e.target.value) || undefined })} /> : null}
                    {!isServices && !isRealEstate && <input className={fld} placeholder={t.pMoq} value={p.moq || ''} onChange={e => updProduct(idx, { moq: e.target.value })} />}
                    <input className={fld} placeholder={t.pStock} value={p.stockLabel || ''} onChange={e => updProduct(idx, { stockLabel: e.target.value })} />
                    <textarea className={fld + ' col-span-2 md:col-span-4'} rows={1} placeholder={t.pDesc} value={p.description || ''} onChange={e => updProduct(idx, { description: e.target.value })} />
                    <input
                      className={fld + ' col-span-2 md:col-span-4'}
                      placeholder={t.pKeywords}
                      value={formatSearchKeywordsForInput(p.searchKeywords)}
                      onChange={e => updProduct(idx, { searchKeywords: parseSearchKeywords(e.target.value) })}
                      title={t.pKeywordsHint}
                    />
                    <input className={fld + ' col-span-2 md:col-span-4 dir-ltr'} placeholder={t.pVideo} value={p.videoUrl || ''} onChange={e => updProduct(idx, { videoUrl: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" className="accent-indigo-600" checked={p.active !== false} onChange={e => updProduct(idx, { active: e.target.checked })} />{t.active}</label>
                    <label className={`flex items-center gap-1 text-[11px] ${(!p.featured && featuredCount >= 3) ? 'text-gray-300' : 'text-amber-600'}`} title={t.featuredFull}><input type="checkbox" className="accent-amber-500" checked={!!p.featured} disabled={!p.featured && featuredCount >= 3} onChange={e => updProduct(idx, { featured: e.target.checked })} />★ {t.featured}</label>
                    {!isRealEstate && <label className="flex items-center gap-1 text-[11px] text-emerald-600" title={t.hidePriceTip}><input type="checkbox" className="accent-emerald-600" checked={!!p.hidePrice} onChange={e => updProduct(idx, { hidePrice: e.target.checked })} />{t.hidePrice}</label>}
                    <label className="flex items-center gap-1 text-[11px] text-red-600" title={t.outOfStockTip}><input type="checkbox" className="accent-red-600" checked={!!p.outOfStock} onChange={e => updProduct(idx, { outOfStock: e.target.checked })} />{t.outOfStock}</label>
                    {!isRealEstate && (p.hidePrice || draft.hidePrices) && (
                      <select className="text-[10px] border border-gray-200 rounded px-1 py-0.5 max-w-[120px] text-gray-600" title={t.priceLabelTip} value={p.hidePriceText || ''} onChange={e => updProduct(idx, { hidePriceText: e.target.value || undefined })}>
                        <option value="">{t.priceLabelInherit}</option>
                        <option value={t.priceLabelContact}>{t.priceLabelContact}</option>
                      </select>
                    )}
                    <select
                      className="text-[10px] border border-gray-200 rounded px-1 py-0.5 max-w-[130px] text-gray-600"
                      title={t.productImageFitTip}
                      value={p.imageFit || ''}
                      onChange={e => updProduct(idx, { imageFit: (e.target.value || undefined) as 'cover' | 'contain' | undefined })}
                    >
                      <option value="">{t.imageFitInherit}</option>
                      <option value="cover">{t.imageFitCover}</option>
                      <option value="contain">{t.imageFitContain}</option>
                    </select>
                    {shopLangs().length > 0 && <button onClick={() => setTransOpen(s => ({ ...s, [p.id]: !s[p.id] }))} className={`text-[10px] px-1.5 py-0.5 rounded mt-1 ${transOpen[p.id] ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`} title={t.transBtn}>🌐 {t.transBtn}</button>}
                    <button onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-600 mt-1"><IconTrash className="w-4 h-4" /></button>
                  </div>
                </div>

                {isRealEstate && (
                  <MetaShopRealEstateFields
                    value={p.realEstate}
                    onChange={re => updProduct(idx, { realEstate: re })}
                    lang={lang}
                    currency={p.currency || draft.currency}
                  />
                )}

                {/* Per-language translations */}
                {transOpen[p.id] && shopLangs().length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                    {shopLangs().filter(l => l.code).map(lg => (
                      <div key={lg.code} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500 w-20 shrink-0">{t.transFor} {lg.name || lg.code}</span>
                        <input className={fld} placeholder={t.pName} value={p.i18n?.[lg.code]?.name || ''} onChange={e => updProductI18n(idx, lg.code, 'name', e.target.value)} />
                        <input className={fld} placeholder={t.pGroup} value={p.i18n?.[lg.code]?.group || ''} onChange={e => updProductI18n(idx, lg.code, 'group', e.target.value)} />
                        <input className={fld} placeholder={t.pSubcat} value={p.i18n?.[lg.code]?.subcategory || ''} onChange={e => updProductI18n(idx, lg.code, 'subcategory', e.target.value)} />
                        <input className={fld} placeholder={t.pStock} value={p.i18n?.[lg.code]?.stockLabel || ''} onChange={e => updProductI18n(idx, lg.code, 'stockLabel', e.target.value)} />
                        <input className={fld + ' col-span-2'} placeholder={t.pDesc} value={p.i18n?.[lg.code]?.description || ''} onChange={e => updProductI18n(idx, lg.code, 'description', e.target.value)} />
                        {(p.hidePrice || draft.hidePrices) && (
                          <input className={fld} placeholder={t.priceLabel} value={p.i18n?.[lg.code]?.hidePriceText || ''} onChange={e => updProductI18n(idx, lg.code, 'hidePriceText', e.target.value)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-product discount */}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-[11px] font-bold text-gray-600">{t.pDiscount}:</label>
                    <select className={fld + ' bg-white max-w-[150px]'} value={p.discountType || ''} onChange={e => updProduct(idx, { discountType: (e.target.value || undefined) as any, discountValue: e.target.value ? p.discountValue : undefined })}>
                      <option value="">{t.pDiscNone}</option>
                      <option value="percent">{t.pDiscPercent}</option>
                      <option value="amount">{t.pDiscAmount}</option>
                    </select>
                    {p.discountType && (
                      <input className={fld + ' max-w-[120px]'} type="number" placeholder={t.pDiscValue} value={p.discountValue ?? ''} onChange={e => updProduct(idx, { discountValue: parseFloat(e.target.value) || 0 })} />
                    )}
                    {p.discountType === 'percent' && <span className="text-[11px] text-gray-400">٪</span>}
                  </div>
                  {p.discountType && <p className="text-[11px] text-gray-400 mt-1">{t.pDiscHint}</p>}
                </div>

                {!isRealEstate && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <MetaShopProductMarkupFields
                      T={T}
                      product={p}
                      inheritsShop={!!draft.priceMarkupType && (draft.priceMarkupValue ?? 0) !== 0}
                      onChange={patch => updProduct(idx, patch)}
                      onPriceAction={action => {
                        logPriceAction(action);
                        if (action.kind === 'product_revert' && priceBaselineRef.current) {
                          const reverted = revertProductToBase(action.product);
                          priceBaselineRef.current = priceBaselineRef.current.map(bp =>
                            bp.id === reverted.id ? reverted : bp,
                          );
                        }
                      }}
                    />
                    <MetaShopProductPromoLabelField
                      T={T}
                      product={p}
                      onChange={patch => updProduct(idx, patch)}
                      translationLangs={langOptions().filter(l => l.code !== 'fa')}
                      onI18nChange={(code, val) => updProductI18n(idx, code, 'promoLabel', val)}
                    />
                  </div>
                )}

                {/* Export terms & origin (products only) */}
                {!isRealEstate && !isServices && (
                  <MetaShopProductExportFields T={T} product={p} onChange={patch => updProduct(idx, patch)} />
                )}

                {/* Bulk price tiers (products) or rate options (services) */}
                {!isRealEstate && (
                  isServices ? (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-600">{t.rateOptions}</label>
                    {(p.priceOptions || []).length < 3 && <button onClick={() => addRate(idx)} className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addRate}</button>}
                  </div>
                  {(p.priceOptions || []).length === 0 ? <p className="text-[11px] text-gray-400">{t.rateHint}</p> : (
                    <div className="space-y-1.5">
                      {(p.priceOptions || []).map((o, oIdx) => (
                        <div key={o.id} className="flex items-center gap-1.5">
                          <input className={fld} placeholder={t.optLabel} value={o.label} onChange={e => updRate(idx, oIdx, { label: e.target.value })} />
                          <input className={fld + ' dir-ltr'} placeholder={t.optLabelEn} value={o.labelEn || ''} onChange={e => updRate(idx, oIdx, { labelEn: e.target.value })} />
                          <input className={fld + ' max-w-[100px]'} type="number" placeholder={t.optPrice} value={o.price ?? ''} onChange={e => updRate(idx, oIdx, { price: parseFloat(e.target.value) || 0 })} />
                          <input className={fld + ' max-w-[78px] dir-ltr'} placeholder={t.optCur} value={o.currency || ''} onChange={e => updRate(idx, oIdx, { currency: e.target.value.toUpperCase() })} />
                          <button onClick={() => removeRate(idx, oIdx)} className="text-red-400 hover:text-red-600 shrink-0"><IconTrash className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                  ) : (
                    <MetaShopProductPriceTiersEditor
                      T={T}
                      product={p}
                      currency={draft.currency}
                      onChange={patch => updProduct(idx, patch)}
                    />
                  )
                )}
              </div>
            ))}
            {draft.products.length > editorProductShown && (
              <div className="flex flex-col items-center gap-2 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {T
                    ? `نمایش ${editorProductShown} از ${draft.products.length} محصول`
                    : `Showing ${editorProductShown} of ${draft.products.length} products`}
                </p>
                <button
                  type="button"
                  onClick={() => setEditorProductShown(n => Math.min(n + EDITOR_PRODUCT_PAGE_SIZE, draft.products.length))}
                  className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {T ? 'بارگذاری بیشتر' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pages & Tabs */}
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold text-gray-700">{t.pagesT} <span className="text-xs text-gray-400">({pages().length})</span></h4>
          <button onClick={addPage} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addPage}</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t.pagesHint}</p>
        {pages().length === 0 ? <p className="text-sm text-gray-400 text-center py-4">{t.noPages}</p> : (
          <div className="space-y-4">
            {pages().map((pg, idx) => (
              <div key={pg.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => movePage(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30 text-xs px-1">▲</button>
                    <button onClick={() => movePage(idx, 1)} disabled={idx === pages().length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30 text-xs px-1">▼</button>
                  </div>
                  <select className={fld + ' bg-white max-w-[200px]'} value={pg.type} onChange={e => updPage(idx, { type: e.target.value as any })}>
                    <option value="text">{t.pgText}</option><option value="gallery">{t.pgGallery}</option><option value="cards">{t.pgCards}</option>
                  </select>
                  <button onClick={() => removePage(idx)} className="text-red-400 hover:text-red-600 ml-auto"><IconTrash className="w-4 h-4" /></button>
                </div>
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-2">{t.pgDefault}</p>
                  <input className={fld + ' mb-2'} placeholder={t.pgLabel} value={pg.label} onChange={e => setPageLangField(idx, 'fa', 'label', e.target.value)} />
                  {pg.type === 'text' && (
                    <textarea className={fld} rows={5} placeholder={t.pgBody} value={pg.body || ''} onChange={e => setPageLangField(idx, 'fa', 'body', e.target.value)} />
                  )}
                  {(pg.type === 'gallery' || pg.type === 'cards') && (
                    <input className={fld} placeholder={t.pgDesc} value={pg.description || ''} onChange={e => setPageLangField(idx, 'fa', 'description', e.target.value)} />
                  )}
                </div>

                {pageEditorLangs().length > 0 && (
                  <div className="mb-3">
                    <button type="button" onClick={() => setPageTransOpen(s => ({ ...s, [pg.id]: !s[pg.id] }))} className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${pageTransOpen[pg.id] ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      🌐 {t.pgI18n} ({pageEditorLangs().length})
                    </button>
                    {pageTransOpen[pg.id] && (
                      <div className="mt-3 space-y-3">
                        <p className="text-[11px] text-gray-400">{t.pgI18nHint}</p>
                        {pageEditorLangs().map(lg => (
                          <div key={lg.code} className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                            <div className="text-xs font-bold text-indigo-700 mb-2">{lg.name || lg.code}</div>
                            <input className={fld + ' mb-2' + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} placeholder={t.pgLabel} value={pageLangField(pg, lg.code, 'label')} onChange={e => setPageLangField(idx, lg.code, 'label', e.target.value)} />
                            {pg.type === 'text' && (
                              <textarea className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} rows={4} placeholder={t.pgBody} value={pageLangField(pg, lg.code, 'body')} onChange={e => setPageLangField(idx, lg.code, 'body', e.target.value)} />
                            )}
                            {(pg.type === 'gallery' || pg.type === 'cards') && (
                              <input className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} placeholder={t.pgDesc} value={pageLangField(pg, lg.code, 'description')} onChange={e => setPageLangField(idx, lg.code, 'description', e.target.value)} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* images (text + gallery) */}
                {(pg.type === 'text' || pg.type === 'gallery') && (
                  <div className="mt-2">
                    <label className="text-[11px] font-semibold text-gray-500">{t.pgImages}</label>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {(pg.images || []).map((src, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                          <img src={src} className="w-full h-full object-cover" />
                          <button onClick={() => removePageImage(idx, i)} className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 leading-none opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                      ))}
                      <PageImageUploader onUpload={url => addPageImage(idx, url)} lang={lang} />
                    </div>
                  </div>
                )}

                {/* cards */}
                {pg.type === 'cards' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-semibold text-gray-500">{t.pgCardsList} ({(pg.cards || []).length})</label>
                      <button onClick={() => addCard(idx)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.pgAddCard}</button>
                    </div>
                    <div className="space-y-2">
                      {(pg.cards || []).map((c, cIdx) => (
                        <div key={c.id} className="flex items-start gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50/50">
                          <CardImageUploader image={c.image} onUpload={url => updCard(idx, cIdx, { image: url })} onClear={() => updCard(idx, cIdx, { image: '' })} lang={lang} />
                          <div className="flex-1 min-w-0">
                            <input className={fld + ' mb-1.5'} placeholder={t.cardName} value={c.name || ''} onChange={e => setCardLangField(idx, cIdx, 'fa', 'name', e.target.value)} />
                            <textarea className={fld} rows={2} placeholder={t.cardDesc} value={c.desc || ''} onChange={e => setCardLangField(idx, cIdx, 'fa', 'desc', e.target.value)} />
                            {pageEditorLangs().length > 0 && (
                              <div className="mt-2">
                                <button type="button" onClick={() => setCardTransOpen(s => ({ ...s, [c.id]: !s[c.id] }))} className={`text-[10px] px-1.5 py-0.5 rounded ${cardTransOpen[c.id] ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>🌐 {t.pgCardI18n}</button>
                                {cardTransOpen[c.id] && (
                                  <div className="mt-2 space-y-2">
                                    {pageEditorLangs().map(lg => (
                                      <div key={lg.code} className="p-2 rounded-lg bg-white border border-gray-100">
                                        <div className="text-[10px] font-bold text-indigo-600 mb-1">{lg.name || lg.code}</div>
                                        <input className={fld + ' mb-1' + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} placeholder={t.cardName} value={cardLangField(c, lg.code, 'name')} onChange={e => setCardLangField(idx, cIdx, lg.code, 'name', e.target.value)} />
                                        <textarea className={fld + (!isRtlLang(lg.code, langOptions()) ? ' dir-ltr' : '')} rows={1} placeholder={t.cardDesc} value={cardLangField(c, lg.code, 'desc')} onChange={e => setCardLangField(idx, cIdx, lg.code, 'desc', e.target.value)} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <button onClick={() => removeCard(idx, cIdx)} className="text-red-400 hover:text-red-600 shrink-0"><IconTrash className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {importModalEl()}
      {embedModalEl()}
      <input type="file" ref={updateFileRef} className="hidden" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f && updateShop) updateShopFromFile(updateShop, f); e.target.value = ''; setUpdateShop(null); }} />
    </div>
  );
};

// Track image uploads with progress bar + success checkmark
type ImageUploadTrack = {
  id: string;
  label: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

const startImageUpload = (
  file: File,
  onUrl: (url: string) => void,
  setTracks: React.Dispatch<React.SetStateAction<ImageUploadTrack[]>>,
  lang: Language,
) => {
  const T = lang === 'fa';
  const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  setTracks(prev => [...prev, { id, label: file.name, progress: 0, status: 'uploading' }]);
  const stallTimer = window.setTimeout(() => {
    setTracks(prev => prev.map(t => (
      t.id === id && t.status === 'uploading' && t.progress < 5
        ? { ...t, status: 'error', error: T ? 'اتصال کند یا قطع — دوباره تلاش کنید یا لینک URL بچسبانید' : 'Slow or blocked connection — retry or paste a URL' }
        : t
    )));
  }, 45_000);
  uploadFileWithProgress(
    file,
    p => setTracks(prev => prev.map(t => (t.id === id ? { ...t, progress: Math.round(p) } : t))),
    url => {
      window.clearTimeout(stallTimer);
      onUrl(url);
      setTracks(prev => prev.map(t => (t.id === id ? { ...t, status: 'done', progress: 100 } : t)));
      window.setTimeout(() => setTracks(prev => prev.filter(t => t.id !== id)), 2800);
    },
    err => {
      window.clearTimeout(stallTimer);
      setTracks(prev => prev.map(t => (t.id === id ? { ...t, status: 'error', error: err.message } : t)));
    },
    'images',
  );
};

const ImageUploadProgressList: React.FC<{ tracks: ImageUploadTrack[]; lang: Language }> = ({ tracks, lang }) => {
  if (!tracks.length) return null;
  const T = lang === 'fa';
  return (
    <div className="mt-1.5 space-y-1 w-full">
      {tracks.map(t => (
        <div key={t.id} className="rounded-md border border-gray-100 bg-gray-50 px-1.5 py-1">
          <div className="flex items-center gap-1 text-[10px] text-gray-600 min-w-0">
            <span className="truncate flex-1" title={t.label}>{t.label}</span>
            {t.status === 'uploading' && <span className="shrink-0 tabular-nums text-indigo-600">{t.progress}%</span>}
            {t.status === 'done' && <span className="shrink-0 text-emerald-600 font-bold flex items-center gap-0.5"><IconCheck className="w-3 h-3" />{T ? 'آپلود شد' : 'Done'}</span>}
            {t.status === 'error' && <span className="shrink-0 text-red-500 font-bold">✕</span>}
          </div>
          {t.status === 'uploading' && (
            <div className="mt-0.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-[width] duration-200 ease-out" style={{ width: `${Math.max(t.progress, 4)}%` }} />
            </div>
          )}
          {t.status === 'error' && t.error && <p className="text-[9px] text-red-500 mt-0.5 leading-snug">{t.error}</p>}
        </div>
      ))}
    </div>
  );
};

// Page image adder (upload OR paste URL)
const PageImageUploader: React.FC<{ onUpload: (url: string) => void; lang: Language }> = ({ onUpload, lang }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<ImageUploadTrack[]>([]);
  const [url, setUrl] = useState('');
  const uploading = tracks.some(t => t.status === 'uploading');
  return (
    <div className="flex flex-col gap-1 w-16">
      <div onClick={() => !uploading && ref.current?.click()} className={`w-16 h-16 rounded-lg border-2 border-dashed bg-gray-50 flex items-center justify-center text-gray-300 ${uploading ? 'border-indigo-300 bg-indigo-50 cursor-wait' : 'border-gray-300 hover:bg-gray-100 cursor-pointer'}`}>
        {uploading ? <span className="text-[9px] text-indigo-600 font-bold">…</span> : <IconUpload className="w-4 h-4" />}
      </div>
      <ImageUploadProgressList tracks={tracks} lang={lang} />
      <div className="flex gap-0.5">
        <input className="flex-1 min-w-0 px-1 py-0.5 rounded border border-gray-200 text-[9px] outline-none dir-ltr" placeholder="URL" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const u = normalizeImageUrl(url.trim()); if (u) { onUpload(u); setUrl(''); } } }} />
        <button type="button" onClick={() => { const u = normalizeImageUrl(url.trim()); if (u) { onUpload(u); setUrl(''); } }} disabled={!url.trim()} className="px-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-500"><IconPlus className="w-2.5 h-2.5" /></button>
      </div>
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) startImageUpload(f, onUpload, setTracks, lang); e.target.value = ''; }} />
    </div>
  );
};

// Card image (upload OR paste URL)
const CardImageUploader: React.FC<{ image?: string; onUpload: (url: string) => void; onClear: () => void; lang: Language }> = ({ image, onUpload, onClear, lang }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<ImageUploadTrack[]>([]);
  const [url, setUrl] = useState('');
  const uploading = tracks.some(t => t.status === 'uploading');
  return (
    <div className="shrink-0 w-12">
      <div onClick={() => !uploading && ref.current?.click()} className={`w-12 h-12 rounded-lg border-2 border-dashed bg-white overflow-hidden flex items-center justify-center text-gray-300 ${uploading ? 'border-indigo-300 cursor-wait' : 'border-gray-300 hover:bg-gray-100 cursor-pointer'}`}>
        {image ? <img src={metaShopProductImageUrl(image, 96) || image} className="w-full h-full object-contain" alt="" referrerPolicy="no-referrer" /> : (uploading ? <span className="text-[8px] text-indigo-600">…</span> : <IconUpload className="w-3.5 h-3.5" />)}
      </div>
      <ImageUploadProgressList tracks={tracks} lang={lang} />
      {image ? <button type="button" onClick={onClear} className="text-[9px] text-red-400 w-full text-center">✕</button>
        : <input className="w-12 mt-0.5 px-1 py-0.5 rounded border border-gray-200 text-[8px] outline-none dir-ltr" placeholder="URL" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const u = normalizeImageUrl(url.trim()); if (u) { onUpload(u); setUrl(''); } } }} onBlur={() => { const u = normalizeImageUrl(url.trim()); if (u) { onUpload(u); setUrl(''); } }} />}
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) startImageUpload(f, onUpload, setTracks, lang); e.target.value = ''; }} />
    </div>
  );
};

// Thumbnail for pasted / external image URLs in the product editor
const EditorImageThumb: React.FC<{ src: string }> = ({ src }) => {
  const direct = normalizeImageUrl(src);
  const initial = direct ? (metaShopProductImageUrl(direct, 120) || direct) : '';
  const [imgSrc, setImgSrc] = useState(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const d = normalizeImageUrl(src);
    setImgSrc(d ? (metaShopProductImageUrl(d, 120) || d) : '');
    setFailed(false);
  }, [src]);

  if (!direct) {
    return <div className="w-full h-full bg-red-50 flex items-center justify-center text-red-400 text-[10px]">!</div>;
  }
  if (failed) {
    return (
      <div className="w-full h-full bg-amber-50 flex items-center justify-center text-amber-600 text-[8px] px-0.5 text-center leading-tight" title={direct}>
        ⚠
      </div>
    );
  }
  return (
    <img
      src={imgSrc}
      className="w-full h-full object-contain bg-gray-50"
      alt=""
      referrerPolicy="no-referrer"
      onError={() => {
        if (imgSrc !== direct) {
          setImgSrc(direct);
          return;
        }
        setFailed(true);
      }}
    />
  );
};

// Multi-image gallery uploader for a product (upload several OR paste image URLs; first = main)
const ProductGallery: React.FC<{ images: string[]; onChange: (imgs: string[]) => void; lang: Language }> = ({ images, onChange, lang }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<ImageUploadTrack[]>([]);
  const [url, setUrl] = useState('');
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const uploading = tracks.some(t => t.status === 'uploading');

  const appendImage = (u: string) => {
    const next = [...imagesRef.current, u];
    imagesRef.current = next;
    onChange(next);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach(f => startImageUpload(f, appendImage, setTracks, lang));
  };

  const addUrl = () => {
    const u = normalizeImageUrl(url.trim());
    if (!u || !/^https?:\/\//i.test(u)) {
      if (url.trim()) {
        alert(lang === 'fa' ? 'لینک عکس معتبر نیست — با https:// شروع شود' : 'Invalid image URL — must start with https://');
      }
      return;
    }
    appendImage(u);
    setUrl('');
  };

  return (
    <div className="shrink-0 w-[min(100%,200px)]">
      <div className="grid grid-cols-4 gap-1">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="relative w-[34px] h-[34px] rounded overflow-hidden border border-gray-200 group bg-gray-50">
            <EditorImageThumb src={src} />
            {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-indigo-600/80 text-white text-[6px] text-center leading-tight">{lang === 'fa' ? 'اصلی' : 'main'}</span>}
            <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-red-500 text-white text-[8px] w-3 h-3 leading-none opacity-0 group-hover:opacity-100">✕</button>
          </div>
        ))}
        <div
          onClick={() => !uploading && ref.current?.click()}
          className={`w-[34px] h-[34px] rounded border-2 border-dashed flex items-center justify-center ${uploading ? 'border-indigo-400 bg-indigo-50 text-indigo-500 cursor-wait' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-300 cursor-pointer'}`}
          title={lang === 'fa' ? 'آپلود عکس' : 'Upload image'}
        >
          {uploading ? <span className="text-[8px] font-bold">…</span> : <IconUpload className="w-3 h-3" />}
        </div>
      </div>
      <ImageUploadProgressList tracks={tracks} lang={lang} />
      <div className="flex gap-1 mt-1">
        <input className="flex-1 min-w-0 px-1.5 py-1 rounded border border-gray-200 text-[10px] outline-none dir-ltr focus:border-indigo-400" placeholder={lang === 'fa' ? 'لینک عکس' : 'image URL'} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        <button type="button" onClick={addUrl} disabled={!url.trim()} className="px-1.5 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-500 shrink-0"><IconPlus className="w-3 h-3" /></button>
      </div>
      <input type="file" ref={ref} className="hidden" accept="image/*" multiple onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
};
