import React, { useState, useMemo, useRef } from 'react';
import { MetaShop, MetaShopProduct, MetaShopOrder, MetaShopType, Personnel, AppConfig, Department } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconCopy, IconLink, IconSearch, IconUsers, IconSettings, IconUpload, IconGlobe, IconTag } from './Icons';
import { uploadFileWithProgress } from '../services/firebaseService';
import { downloadSample } from './metaShopSamples';
import { MetaBazaarManager } from './MetaBazaarManager';
import { MetaBazaar } from '../types';
import { Language } from '../App';

interface Props {
  metaShops: MetaShop[];
  metaShopOrders: MetaShopOrder[];
  personnel: Personnel[];
  config: AppConfig;
  lang: Language;
  shopBaseUrl: string;
  onSaveMetaShop: (shop: MetaShop) => Promise<void>;
  onDeleteMetaShop: (id: string) => Promise<void>;
  onUpdateMetaShopOrder: (id: string, updates: Partial<MetaShopOrder>) => Promise<void>;
  metaBazaars?: MetaBazaar[];
  onSaveMetaBazaar?: (b: MetaBazaar) => Promise<void>;
  onDeleteMetaBazaar?: (id: string) => Promise<void>;
  readonly?: boolean;
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
    return {
      ...base, ...json,
      id: base.id, createdAt: base.createdAt,
      theme: { ...DEFAULT_THEME, ...(json.theme || {}) },
      type: (json.type === 'services' ? 'services' : 'products') as MetaShopType,
      products: json.products.map((p: any, i: number) => ({
        ...p,
        id: p.id || `p-${Date.now()}-${i}`,
        images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
        active: p.active !== false,
      })),
    };
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

export const MetaShopManager: React.FC<Props> = ({ metaShops, metaShopOrders, personnel, config, lang, shopBaseUrl, onSaveMetaShop, onDeleteMetaShop, onUpdateMetaShopOrder, metaBazaars = [], onSaveMetaBazaar, onDeleteMetaBazaar, readonly = false }) => {
  const [section, setSection] = useState<'shops' | 'bazaars'>('shops');
  const [mode, setMode] = useState<'list' | 'editor' | 'orders'>('list');
  const [draft, setDraft] = useState<MetaShop | null>(null);
  const [ordersShopId, setOrdersShopId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);
  const [updateShop, setUpdateShop] = useState<MetaShop | null>(null);
  const [dirCatFa, setDirCatFa] = useState('');
  const [dirCatEn, setDirCatEn] = useState('');
  const [transOpen, setTransOpen] = useState<Record<string, boolean>>({});
  const T = lang === 'fa';
  const departments: Department[] = config.departments || [];

  const t = {
    title: T ? 'متاشاپ' : 'Meta Shop', subtitle: T ? 'فروشگاه‌های آنلاین شما' : 'Your online shops',
    newShop: T ? 'فروشگاه جدید' : 'New Shop', importJson: T ? 'ساخت از JSON' : 'Import from JSON',
    empty: T ? 'هنوز فروشگاهی نساخته‌اید.' : 'No shops yet.',
    edit: T ? 'ویرایش' : 'Edit', del: T ? 'حذف' : 'Delete', open: T ? 'باز کردن' : 'Open', copy: T ? 'کپی لینک' : 'Copy link', copied: T ? 'کپی شد ✓' : 'Copied ✓',
    orders: T ? 'سفارش‌ها' : 'Orders', active: T ? 'فعال' : 'Active', inactive: T ? 'غیرفعال' : 'Inactive',
    downloadJson: T ? 'دانلود فایل JSON این فروشگاه' : 'Download this shop as JSON', updateJson: T ? 'به‌روزرسانی از فایل JSON' : 'Update from JSON file',
    dirT: T ? 'دسته‌بندی در بازارچه (لینک همه فروشگاه‌ها)' : 'Bazaar category (all-shops page)',
    dirHint: T ? 'این فروشگاه در صفحه‌ی «همه فروشگاه‌ها» زیر این دسته‌ها نمایش داده می‌شود. دسته‌ها دوزبانه‌اند (فارسی و انگلیسی).' : 'This shop appears under these categories on the all-shops page. Categories are bilingual (FA & EN).',
    dirCat: T ? 'دسته‌ها' : 'Categories', dirCatMulti: T ? '(می‌توانید چند دسته اضافه کنید)' : '(add several)', dirSub: T ? 'زیردسته' : 'Subcategory', shopNo: T ? 'شماره مغازه (پلاک)' : 'Shop number (plate)',
    allShopsLink: T ? 'لینک همه فروشگاه‌ها' : 'All-shops link', allShopsCopied: T ? 'کپی شد ✓' : 'Copied ✓', openBazaar: T ? 'بازارچه' : 'Bazaar',
    back: T ? 'بازگشت' : 'Back', save: T ? 'ذخیره فروشگاه' : 'Save shop', cancel: T ? 'انصراف' : 'Cancel',
    basics: T ? 'اطلاعات پایه' : 'Basics', theme: T ? 'رنگ‌بندی قالب' : 'Theme', cover: T ? 'کاور و معرفی' : 'Cover & intro',
    contact: T ? 'تماس و فوتر' : 'Contact & footer', routing: T ? 'ارجاع سفارش‌ها' : 'Order routing', productsT: T ? 'محصولات / خدمات' : 'Products / Services',
    name: T ? 'نام فروشگاه' : 'Shop name', slug: T ? 'شناسه لینک (slug)' : 'Link slug', type: T ? 'نوع' : 'Type',
    typeProducts: T ? 'محصولات' : 'Products', typeServices: T ? 'خدمات' : 'Services', currency: T ? 'واحد پول' : 'Currency',
    defLang: T ? 'زبان پیش‌فرض نمایش' : 'Default display language', langFa: T ? 'فارسی' : 'Persian', langEn: T ? 'انگلیسی' : 'English',
    langsT: T ? 'زبان‌های فروشگاه' : 'Shop languages', langsHint: T ? 'زبان‌هایی که مشتری می‌تواند بین آن‌ها سوییچ کند. کد مثل en، fa، zh، ar. ترجمه‌ی محتوا (نام/توضیحات محصول) را در همان محصول وارد کنید.' : 'Languages the customer can switch between. Code like en, fa, zh, ar. Enter content translations on each product.',
    langCode: T ? 'کد' : 'Code', langName: T ? 'نام نمایشی' : 'Display name', langRtl: T ? 'راست‌چین' : 'RTL', addLang: T ? 'افزودن زبان' : 'Add language',
    transBtn: T ? 'ترجمه‌ها' : 'Translations', transFor: T ? 'ترجمه برای' : 'Translation for',
    pagesT: T ? 'صفحات و تب‌ها' : 'Pages & Tabs', pagesHint: T ? 'تب‌های اضافی فروشگاه مثل «درباره ما» یا «گواهینامه‌ها». تب «محصولات/خدمات» همیشه هست.' : 'Extra shop tabs like About Us or Certifications. The products tab is always present.',
    addPage: T ? 'افزودن صفحه' : 'Add page', noPages: T ? 'صفحه‌ای اضافه نشده است.' : 'No pages added.',
    pgLabel: T ? 'عنوان تب (فارسی)' : 'Tab label (FA)', pgLabelEn: T ? 'عنوان تب (انگلیسی)' : 'Tab label (EN)', pgType: T ? 'نوع صفحه' : 'Page type',
    pgText: T ? 'متن + تصویر' : 'Text + images', pgGallery: T ? 'گالری عکس' : 'Photo gallery', pgCards: T ? 'کارت‌ها (گواهینامه/شرکا)' : 'Cards (certs/partners)',
    pgBody: T ? 'متن (فارسی)' : 'Body (FA)', pgBodyEn: T ? 'متن (انگلیسی)' : 'Body (EN)', pgDesc: T ? 'توضیح (فارسی)' : 'Description (FA)', pgDescEn: T ? 'توضیح (انگلیسی)' : 'Description (EN)',
    pgImages: T ? 'تصاویر' : 'Images', pgAddImg: T ? 'افزودن تصویر' : 'Add image', pgCardsList: T ? 'کارت‌ها' : 'Cards', pgAddCard: T ? 'افزودن کارت' : 'Add card',
    cardName: T ? 'عنوان (فارسی)' : 'Name (FA)', cardNameEn: T ? 'عنوان (انگلیسی)' : 'Name (EN)', cardDesc: T ? 'توضیح (فارسی)' : 'Desc (FA)', cardDescEn: T ? 'توضیح (انگلیسی)' : 'Desc (EN)',
    productsTabLabel: T ? 'عنوان تب محصولات (فارسی)' : 'Products tab label (FA)', productsTabLabelEn: T ? 'عنوان تب محصولات (انگلیسی)' : 'Products tab label (EN)',
    moveUp: T ? 'بالا' : 'Up', moveDown: T ? 'پایین' : 'Down',
    feesT: T ? 'هزینه‌های پیش‌فرض (ارسال، بسته‌بندی، ...)' : 'Default fees (shipping, packaging, ...)',
    feesHint: T ? 'این هزینه‌ها در صفحه سفارش به مشتری نشان داده می‌شوند. اگر «الزامی» باشد همیشه به جمع اضافه می‌شود؛ در غیر این صورت مشتری انتخاب می‌کند.' : 'Shown to the customer at checkout. If "required" it is always added; otherwise the customer chooses.',
    addFee: T ? 'افزودن هزینه' : 'Add fee', feeLabel: T ? 'عنوان (فارسی)' : 'Label (FA)', feeLabelEn: T ? 'عنوان (انگلیسی)' : 'Label (EN)', feeAmount: T ? 'مبلغ' : 'Amount',
    feeRequired: T ? 'الزامی' : 'Required', feeDefaultOn: T ? 'پیش‌فعال' : 'Pre-checked', noFees: T ? 'هزینه‌ای تعریف نشده است.' : 'No fees defined.',
    taxT: T ? 'مالیات (VAT)' : 'Tax (VAT)', taxRate: T ? 'درصد مالیات' : 'Tax rate (%)', taxMode: T ? 'حالت' : 'Mode',
    taxIncl: T ? 'تجمیعی (داخل قیمت) — Inclusive' : 'Inclusive (in prices)', taxExcl: T ? 'افزوده به جمع — Exclusive' : 'Exclusive (added on top)',
    taxLabelF: T ? 'عنوان مالیات (فارسی)' : 'Tax label (FA)', taxLabelEnF: T ? 'عنوان مالیات (انگلیسی)' : 'Tax label (EN)',
    taxHint: T ? 'اگر درصد بگذاری، در صفحه سفارش نمایش داده می‌شود. تجمیعی یعنی داخل قیمت‌هاست؛ افزوده یعنی روی جمع اضافه می‌شود.' : 'If set, shown at checkout. Inclusive = already in prices; Exclusive = added on top.',
    discT: T ? 'کدهای تخفیف' : 'Discount codes', discHint: T ? 'مشتری کد را در صفحه سفارش وارد می‌کند. می‌توانی کد دلخواه بنویسی یا تولید کنی، نوع درصدی/عددی، و دامنه‌ی اعمال (کل سفارش، محصولات خاص، یا دسته‌ها) را تعیین کنی.' : 'Customer enters the code at checkout. Use a custom code or generate one; percent/fixed; scope (whole order, specific products, or categories).',
    addDisc: T ? 'افزودن کد' : 'Add code', noDisc: T ? 'کد تخفیفی تعریف نشده است.' : 'No discount codes.', gen: T ? 'تولید کد' : 'Generate',
    discCode: T ? 'کد' : 'Code', discTypePercent: T ? 'درصدی (٪)' : 'Percent (%)', discTypeFixed: T ? 'عددی (مبلغ)' : 'Fixed amount', discValue: T ? 'مقدار' : 'Value',
    discScope: T ? 'دامنه اعمال' : 'Applies to', scopeAll: T ? 'کل سفارش' : 'Whole order', scopeProducts: T ? 'محصولات انتخابی' : 'Selected products', scopeCats: T ? 'دسته‌های انتخابی' : 'Selected categories',
    discMin: T ? 'حداقل مبلغ سفارش (اختیاری)' : 'Min order (optional)', selectProducts: T ? 'محصولات مشمول:' : 'Eligible products:', selectCats: T ? 'دسته‌های مشمول:' : 'Eligible categories:',
    primary: T ? 'رنگ اصلی' : 'Primary', coverC: T ? 'رنگ کاور' : 'Cover', coverText: T ? 'متن کاور' : 'Cover text', bg: T ? 'پس‌زمینه' : 'Background',
    collection: T ? 'متن بالای عنوان' : 'Collection text', heroTitle: T ? 'عنوان اصلی' : 'Title', heroSub: T ? 'زیرعنوان' : 'Subtitle',
    coverImg: T ? 'تصویر کاور (پس‌زمینه)' : 'Cover image (background)', logo: T ? 'لوگو' : 'Logo', upload: T ? 'آپلود' : 'Upload', uploading: T ? 'در حال آپلود...' : 'Uploading...',
    orLink: T ? 'یا لینک تصویر' : 'or image URL', addLink: T ? 'افزودن لینک' : 'Add URL', imgUrlPh: T ? 'https://...  (لینک عکس)' : 'https://...  (image URL)',
    phone: T ? 'تلفن' : 'Phone', email: T ? 'ایمیل' : 'Email', website: T ? 'وب‌سایت' : 'Website', address: T ? 'آدرس' : 'Address', footer: T ? 'متن فوتر' : 'Footer text',
    thanksTxt: T ? 'متن تشکر پس از سفارش' : 'Order thank-you text', cartBtn: T ? 'متن دکمه سفارش' : 'Order button text',
    routeHint: T ? 'سفارش‌های این فروشگاه به کارتابل چه کسانی برود؟' : 'Whose cartable should orders go to?',
    routePersonnel: T ? 'پرسنل مشخص' : 'Specific personnel', routeDept: T ? 'یک دپارتمان' : 'A department', routeNone: T ? 'پیش‌فرض (مستر)' : 'Default (master)',
    addProduct: T ? 'افزودن مورد' : 'Add item', noProducts: T ? 'موردی اضافه نشده است.' : 'No items added.',
    pName: T ? 'نام' : 'Name', pSku: T ? 'کد (SKU)' : 'SKU', pGroup: T ? 'دسته' : 'Category', pSubcat: T ? 'زیردسته' : 'Subcategory', pPrice: T ? 'قیمت' : 'Price', pPack: T ? 'قیمت بسته' : 'Pack price',
    pUnit: T ? 'واحد' : 'Unit', pPackSize: T ? 'تعداد در بسته' : 'Pack size', pMoq: T ? 'حداقل سفارش' : 'MOQ', pStock: T ? 'وضعیت موجودی' : 'Stock label', pDesc: T ? 'توضیحات' : 'Description', pImg: T ? 'تصویر' : 'Image',
    pVideo: T ? 'لینک ویدئو (YouTube / Vimeo / mp4)' : 'Video link (YouTube / Vimeo / mp4)',
    rateOptions: T ? 'نرخ‌های چندگانه (حداکثر ۳)' : 'Rate options (max 3)',
    rateHint: T ? 'مثلا: ۱ روز / ۳ روز / ۱۰ روز — یا EXW / FOB / CIF — یا با کرایه / بدون کرایه. اگر تعریف کنی، مشتری یکی را انتخاب می‌کند و همان قیمت اعمال می‌شود.' : 'e.g. 1 day / 3 days / 10 days — or EXW / FOB / CIF — or with/without freight. If set, the customer picks one and that price applies.',
    addRate: T ? 'افزودن نرخ' : 'Add rate', optLabel: T ? 'عنوان (فارسی)' : 'Label (FA)', optLabelEn: T ? 'عنوان (انگلیسی)' : 'Label (EN)', optPrice: T ? 'قیمت' : 'Price',
    importHint: T ? 'JSON کاتالوگ یا فروشگاه را اینجا بچسبانید. محصولات، رنگ‌ها و اطلاعات شرکت خودکار وارد می‌شوند.' : 'Paste catalog or shop JSON. Products, colors and company info are imported automatically.',
    importBtn: T ? 'وارد کردن' : 'Import', importErr: T ? 'JSON نامعتبر است.' : 'Invalid JSON.',
    ordersTitle: T ? 'سفارش‌ها' : 'Orders', noOrders: T ? 'سفارشی ثبت نشده است.' : 'No orders yet.',
    oCode: T ? 'کد رهگیری' : 'Tracking', oCustomer: T ? 'مشتری' : 'Customer', oTotal: T ? 'مبلغ' : 'Total', oDate: T ? 'تاریخ' : 'Date', oStatus: T ? 'وضعیت' : 'Status', oItems: T ? 'اقلام' : 'Items',
    sNew: T ? 'جدید' : 'New', sProg: T ? 'در حال انجام' : 'In progress', sDone: T ? 'انجام شد' : 'Done', sCanc: T ? 'لغو شد' : 'Cancelled',
    deleteConfirm: T ? 'این فروشگاه حذف شود؟' : 'Delete this shop?',
    linkLabel: T ? 'لینک عمومی:' : 'Public link:',
  };

  const ordersByShop = useMemo(() => {
    const m: Record<string, MetaShopOrder[]> = {};
    metaShopOrders.forEach(o => { (m[o.shopId] = m[o.shopId] || []).push(o); });
    return m;
  }, [metaShopOrders]);

  const shopUrl = (shop: MetaShop) => `${shopBaseUrl}?shop=${encodeURIComponent(shop.slug)}`;
  const copyLink = (shop: MetaShop) => { navigator.clipboard.writeText(shopUrl(shop)); setCopiedId(shop.id); setTimeout(() => setCopiedId(null), 1800); };

  // Download a single shop as a JSON file (re-importable / editable)
  const downloadShopJson = (shop: MetaShop) => {
    const blob = new Blob([JSON.stringify(shop, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `metashop-${shop.slug || shop.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // Update an EXISTING shop from an uploaded JSON file (keeps the same id + slug/link)
  const updateShopFromFile = (shop: MetaShop, file: File) => {
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const merged = importFromJson(String(ev.target?.result || ''), shop);
        const updated: MetaShop = { ...merged, id: shop.id, slug: shop.slug, createdAt: shop.createdAt };
        await onSaveMetaShop(updated);
        if (draft && draft.id === shop.id) setDraft(updated);
        alert(T ? 'فروشگاه با موفقیت به‌روزرسانی شد.' : 'Shop updated successfully.');
      } catch { alert(T ? 'فایل JSON نامعتبر است.' : 'Invalid JSON file.'); }
    };
    r.readAsText(file);
  };
  const triggerUpdate = (shop: MetaShop) => { setUpdateShop(shop); updateFileRef.current?.click(); };

  const startNew = () => { setDraft(blankShop()); setMode('editor'); };
  const startEdit = (s: MetaShop) => { setDraft(JSON.parse(JSON.stringify(s))); setMode('editor'); };
  const upd = (patch: Partial<MetaShop>) => setDraft(d => d ? { ...d, ...patch } : d);
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
    if (!draft.name.trim()) { alert(T ? 'نام فروشگاه را وارد کنید.' : 'Enter a shop name.'); return; }
    const slug = (draft.slug || '').trim() || slugify(draft.name);
    // ensure unique slug
    if (metaShops.some(s => s.id !== draft.id && s.slug === slug)) { alert(T ? 'این شناسه لینک قبلاً استفاده شده. شناسه دیگری بگذارید.' : 'This slug is already used. Choose another.'); return; }
    setSaving(true);
    try { await onSaveMetaShop({ ...draft, slug }); setMode('list'); setDraft(null); }
    catch { alert(T ? 'خطا در ذخیره' : 'Save failed'); }
    finally { setSaving(false); }
  };

  const uploadImg = (file: File, onUrl: (url: string) => void) => uploadFileWithProgress(file, () => {}, onUrl, (e) => alert(e.message), 'images');

  // ── Products editing ──
  const addProduct = () => upd({ products: [...(draft!.products || []), { id: `p-${Date.now()}`, name: '', images: [], active: true, price: 0, currency: draft!.currency }] });
  const updProduct = (idx: number, patch: Partial<MetaShopProduct>) => setDraft(d => { if (!d) return d; const products = [...d.products]; products[idx] = { ...products[idx], ...patch }; return { ...d, products }; });
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
  const langOptions = (): { code: string; name: string }[] => { const ls = shopLangs().filter(l => l.code); return ls.length ? ls : [{ code: 'fa', name: 'فارسی' }, { code: 'en', name: 'English' }]; };

  // ── Product rate options (max 3) ──
  const addRate = (idx: number) => { const opts = draft!.products[idx].priceOptions || []; if (opts.length >= 3) return; updProduct(idx, { priceOptions: [...opts, { id: `o-${Date.now()}`, label: '', price: 0 }] }); };
  const updRate = (idx: number, oIdx: number, patch: Partial<{ label: string; labelEn: string; price: number }>) => { const opts = [...(draft!.products[idx].priceOptions || [])]; opts[oIdx] = { ...opts[oIdx], ...patch }; updProduct(idx, { priceOptions: opts }); };
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
  const addFee = () => upd({ extraFees: [...fees(), { id: `fee-${Date.now()}`, label: '', amount: 0 }] });
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

  const doImport = () => {
    try { setDraft(d => importFromJson(importText, d || blankShop())); setImportOpen(false); setImportText(''); setMode('editor'); }
    catch { alert(t.importErr); }
  };

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const shop = importFromJson(String(ev.target?.result || ''), blankShop());
        setDraft(shop); setImportOpen(false); setImportText(''); setMode('editor');
      } catch { alert(t.importErr); }
    };
    r.readAsText(f); e.target.value = '';
  };

  // Reusable import dialog (file upload + sample downloads + optional paste)
  const importModalEl = () => importOpen ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setImportOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><IconUpload className="w-4 h-4" />{t.importJson}</h3>
        <p className="text-xs text-gray-500 mb-3">{t.importHint}</p>

        {/* Sample downloads */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-400 self-center">{T ? 'نمونه:' : 'Samples:'}</span>
          <button onClick={() => downloadSample('products')} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{T ? 'دانلود نمونه محصولات' : 'Products sample'}</button>
          <button onClick={() => downloadSample('services')} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{T ? 'دانلود نمونه خدمات' : 'Services sample'}</button>
        </div>

        {/* File upload (primary) */}
        <button onClick={() => jsonFileRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-700 font-bold text-sm hover:bg-indigo-50 flex items-center justify-center gap-2">
          <IconUpload className="w-5 h-5" />{T ? 'انتخاب فایل JSON و ساخت فروشگاه' : 'Choose JSON file & build shop'}
        </button>
        <input type="file" ref={jsonFileRef} className="hidden" accept=".json,application/json" onChange={handleJsonFile} />

        {/* Optional paste */}
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer">{T ? 'یا چسباندن متن JSON' : 'or paste JSON text'}</summary>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} className={fld + ' font-mono text-xs mt-2'} placeholder='{ "type": "products", "products": [ ... ] }' />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setImportOpen(false)} className="px-3 py-2 text-sm text-gray-500">{t.cancel}</button>
            <button onClick={doImport} disabled={!importText.trim()} className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg disabled:opacity-50">{t.importBtn}</button>
          </div>
        </details>
      </div>
    </div>
  ) : null;

  const statusLabel = (s: MetaShopOrder['status']) => s === 'done' ? t.sDone : s === 'in_progress' ? t.sProg : s === 'cancelled' ? t.sCanc : t.sNew;
  const statusCls = (s: MetaShopOrder['status']) => s === 'done' ? 'bg-emerald-100 text-emerald-700' : s === 'in_progress' ? 'bg-blue-100 text-blue-700' : s === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700';

  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
  const lbl = 'block text-[13px] font-semibold text-gray-700 mb-1.5';
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  // ════════════ LIST ════════════
  // Section toggle (Shops | Bazaars)
  const sectionToggle = (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-1">
      <button onClick={() => setSection('shops')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${section === 'shops' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{T ? 'فروشگاه‌ها' : 'Shops'}</button>
      <button onClick={() => setSection('bazaars')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${section === 'bazaars' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{T ? 'بازارچه‌ها' : 'Bazaars'}</button>
    </div>
  );

  // ════════════ BAZAARS section ════════════
  if (section === 'bazaars' && onSaveMetaBazaar && onDeleteMetaBazaar) {
    return (
      <div className="space-y-4 animate-fade-in">
        {sectionToggle}
        <MetaBazaarManager bazaars={metaBazaars} lang={lang} shopBaseUrl={shopBaseUrl} onSave={onSaveMetaBazaar} onDelete={onDeleteMetaBazaar} readonly={readonly} />
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
            <button onClick={() => { navigator.clipboard.writeText(`${shopBaseUrl}?shops=1`); setCopiedId('__bazaar__'); setTimeout(() => setCopiedId(null), 1800); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5">{copiedId === '__bazaar__' ? t.allShopsCopied : <><IconLink className="w-4 h-4" />{t.allShopsLink}</>}</button>
          {!readonly && <>
            <button onClick={() => { setImportOpen(true); setImportText(''); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"><IconUpload className="w-4 h-4" />{t.importJson}</button>
            <button onClick={startNew} className="px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><IconPlus className="w-4 h-4" />{t.newShop}</button>
          </>}
          </div>
        </div>

        {metaShops.length === 0 ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.empty}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metaShops.map(s => {
              const orders = ordersByShop[s.id] || [];
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="h-20 flex items-center justify-center text-white font-bold relative" style={{ background: s.theme?.cover || '#334155', backgroundImage: s.coverImage ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.45)), url(${s.coverImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <span className="text-sm px-3 text-center">{s.title || s.name}</span>
                    <span className={`absolute top-2 ${T ? 'left-2' : 'right-2'} text-[10px] px-2 py-0.5 rounded-full font-bold ${s.isActive ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'}`}>{s.isActive ? t.active : t.inactive}</span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-gray-800 text-sm truncate">{s.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.type === 'services' ? t.typeServices : t.typeProducts}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">{(s.products || []).length} {T ? 'مورد' : 'items'} · {orders.length} {t.orders}</div>
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] text-gray-500 truncate" dir="ltr"><IconLink className="w-3 h-3 shrink-0" /><span className="truncate">?shop={s.slug}</span></div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <a href={shopUrl(s)} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.open}</a>
                      <button onClick={() => copyLink(s)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">{copiedId === s.id ? t.copied : <><IconCopy className="w-3.5 h-3.5" />{t.copy}</>}</button>
                      <button onClick={() => { setOrdersShopId(s.id); setMode('orders'); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t.orders}{orders.filter(o => o.status === 'new').length > 0 && <span className="ml-1 bg-amber-500 text-white rounded-full px-1.5 text-[10px]">{orders.filter(o => o.status === 'new').length}</span>}</button>
                      <button onClick={() => downloadShopJson(s)} title={t.downloadJson} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">⤓ JSON</button>
                      {!readonly && <button onClick={() => triggerUpdate(s)} title={t.updateJson} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50">⤒ JSON</button>}
                      {!readonly && <button onClick={() => startEdit(s)} className="text-xs px-2 py-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50"><IconEdit className="w-3.5 h-3.5" /></button>}
                      {!readonly && <button onClick={() => { if (confirm(t.deleteConfirm)) onDeleteMetaShop(s.id); }} className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {importModalEl()}
        <input type="file" ref={updateFileRef} className="hidden" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f && updateShop) updateShopFromFile(updateShop, f); e.target.value = ''; setUpdateShop(null); }} />
      </div>
    );
  }

  // ════════════ ORDERS ════════════
  if (mode === 'orders') {
    const shop = metaShops.find(s => s.id === ordersShopId);
    const orders = ordersShopId ? (ordersByShop[ordersShopId] || []) : [];
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <h3 className="text-lg font-bold text-gray-800">{t.ordersTitle} — {shop?.name}</h3>
        {orders.length === 0 ? <div className={card + ' text-center py-12 text-gray-400 text-sm'}>{t.noOrders}</div> : (
          <div className={card + ' overflow-x-auto p-0'}>
            <table className="w-full text-sm text-start">
              <thead className="bg-gray-50 text-gray-500 text-xs"><tr>
                <th className="px-4 py-3 text-start">{t.oCode}</th><th className="px-4 py-3 text-start">{t.oCustomer}</th><th className="px-4 py-3 text-start">{t.oItems}</th><th className="px-4 py-3 text-start">{t.oTotal}</th><th className="px-4 py-3 text-start">{t.oDate}</th><th className="px-4 py-3 text-start">{t.oStatus}</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50/60 align-top">
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">{o.trackingCode}</td>
                    <td className="px-4 py-3"><div className="font-medium text-gray-800">{o.customerName}</div><div className="text-xs text-gray-400" dir="ltr">{o.phone}</div>{o.company && <div className="text-xs text-gray-400">{o.company}</div>}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[220px]">{o.items.map((it, i) => <div key={i} className="truncate">{it.name} × {it.qty}</div>)}{o.discountAmount ? <div className="text-[11px] text-rose-600">− {o.currency} {o.discountAmount.toLocaleString()} ({o.discountCode})</div> : null}{(o.fees || []).map((f, i) => <div key={`f${i}`} className="text-[11px] text-emerald-600">+ {f.label}: {o.currency} {f.amount.toLocaleString()}</div>)}{o.taxAmount ? <div className="text-[11px] text-gray-500">{o.taxInclusive ? (T ? 'شامل مالیات' : 'incl. tax') : (T ? '+ مالیات' : '+ tax')} {o.taxRate}%: {o.currency} {o.taxAmount.toLocaleString()}</div> : null}{o.notes && <div className="text-[11px] text-gray-400 mt-1 italic">📝 {o.notes}</div>}</td>
                    <td className="px-4 py-3 font-bold text-gray-800">{o.currency} {o.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs" dir="ltr">{new Date(o.createdAt).toLocaleString(T ? 'fa-IR' : 'en-US')}</td>
                    <td className="px-4 py-3">
                      <select value={o.status} onChange={e => onUpdateMetaShopOrder(o.id, { status: e.target.value as MetaShopOrder['status'] })} className={`text-[11px] px-2 py-1 rounded-full font-medium border-0 outline-none cursor-pointer ${statusCls(o.status)}`}>
                        <option value="new">{t.sNew}</option><option value="in_progress">{t.sProg}</option><option value="done">{t.sDone}</option><option value="cancelled">{t.sCanc}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ════════════ EDITOR ════════════
  if (!draft) return null;
  const isServices = draft.type === 'services';
  return (
    <div className="space-y-5 animate-fade-in pb-10">
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-gray-50/80 backdrop-blur z-10 py-2">
        <button onClick={() => { setMode('list'); setDraft(null); }} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
        <div className="flex items-center gap-2">
          <a href={draft.slug ? shopUrl(draft) : undefined} target="_blank" rel="noreferrer" className={`text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1 ${!draft.slug ? 'opacity-40 pointer-events-none' : ''}`}><IconGlobe className="w-3.5 h-3.5" />{t.open}</a>
          <button onClick={() => downloadShopJson(draft)} title={t.downloadJson} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">⤓ JSON</button>
          {!readonly && <button onClick={() => triggerUpdate(draft)} title={t.updateJson} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50">⤒ JSON</button>}
          {!readonly && <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"><IconCheck className="w-4 h-4" />{t.save}</button>}
        </div>
      </div>

      {/* Basics */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><IconSettings className="w-4 h-4 text-indigo-500" />{t.basics}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>{t.name}</label><input className={fld} value={draft.name} onChange={e => upd({ name: e.target.value, slug: draft.slug || slugify(e.target.value) })} /></div>
          <div><label className={lbl}>{t.slug}</label><input className={fld + ' dir-ltr'} value={draft.slug} onChange={e => upd({ slug: slugify(e.target.value) })} placeholder="my-shop" /></div>
          <div><label className={lbl}>{t.type}</label><select className={fld + ' bg-white'} value={draft.type} onChange={e => upd({ type: e.target.value as MetaShopType })}><option value="products">{t.typeProducts}</option><option value="services">{t.typeServices}</option></select></div>
          <div><label className={lbl}>{t.currency}</label><input className={fld + ' dir-ltr'} value={draft.currency} onChange={e => upd({ currency: e.target.value })} placeholder="USD / OMR / IRR" /></div>
          <div><label className={lbl}>{t.defLang}</label><select className={fld + ' bg-white'} value={draft.defaultLang || langOptions()[0].code} onChange={e => upd({ defaultLang: e.target.value })}>{langOptions().map(l => <option key={l.code} value={l.code}>{l.name || l.code}</option>)}</select></div>
          <div><label className={lbl}>{t.productsTabLabel}</label><input className={fld} value={draft.productsTabLabel || ''} onChange={e => upd({ productsTabLabel: e.target.value })} placeholder={draft.type === 'services' ? 'خدمات' : 'محصولات'} /></div>
          <div><label className={lbl}>{t.productsTabLabelEn}</label><input className={fld + ' dir-ltr'} value={draft.productsTabLabelEn || ''} onChange={e => upd({ productsTabLabelEn: e.target.value })} placeholder={draft.type === 'services' ? 'Services' : 'Product List'} /></div>
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
        <label className="flex items-center gap-2 mt-4 text-sm text-gray-700"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={draft.isActive} onChange={e => upd({ isActive: e.target.checked })} />{t.active}</label>
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
          <div><label className={lbl}>{t.cartBtn}</label><input className={fld} value={draft.cartButtonText || ''} onChange={e => upd({ cartButtonText: e.target.value })} placeholder={isServices ? (T ? 'ثبت درخواست' : 'Request') : (T ? 'ثبت سفارش' : 'Place Order')} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.thanksTxt}</label><textarea rows={2} className={fld} value={draft.orderThankYouText || ''} onChange={e => upd({ orderThankYouText: e.target.value })} /></div>
        </div>
      </div>

      {/* Contact */}
      <div className={card}>
        <h4 className="font-bold text-gray-700 mb-4">{t.contact}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>{t.phone}</label><input className={fld + ' dir-ltr'} value={draft.phone || ''} onChange={e => upd({ phone: e.target.value })} /></div>
          <div><label className={lbl}>{t.email}</label><input className={fld + ' dir-ltr'} value={draft.email || ''} onChange={e => upd({ email: e.target.value })} /></div>
          <div><label className={lbl}>{t.website}</label><input className={fld + ' dir-ltr'} value={draft.website || ''} onChange={e => upd({ website: e.target.value })} /></div>
          <div><label className={lbl}>{t.address}</label><input className={fld} value={draft.address || ''} onChange={e => upd({ address: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={lbl}>{t.footer}</label><input className={fld} value={draft.footerText || ''} onChange={e => upd({ footerText: e.target.value })} /></div>
        </div>
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

      {/* Default checkout fees */}
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold text-gray-700">{t.feesT} <span className="text-xs text-gray-400">({fees().length})</span></h4>
          <button onClick={addFee} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addFee}</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t.feesHint}</p>
        {fees().length === 0 ? <p className="text-sm text-gray-400 text-center py-3">{t.noFees}</p> : (
          <div className="space-y-2">
            {fees().map((f, idx) => (
              <div key={f.id} className="flex items-center gap-2 flex-wrap border border-gray-100 rounded-lg p-2 bg-gray-50/50">
                <input className={fld + ' flex-1 min-w-[120px]'} placeholder={t.feeLabel} value={f.label} onChange={e => updFee(idx, { label: e.target.value })} />
                <input className={fld + ' flex-1 min-w-[120px] dir-ltr'} placeholder={t.feeLabelEn} value={f.labelEn || ''} onChange={e => updFee(idx, { labelEn: e.target.value })} />
                <input className={fld + ' w-28'} type="number" placeholder={t.feeAmount} value={f.amount ?? ''} onChange={e => updFee(idx, { amount: parseFloat(e.target.value) || 0 })} />
                <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" className="accent-indigo-600" checked={!!f.required} onChange={e => updFee(idx, { required: e.target.checked })} />{t.feeRequired}</label>
                <label className={`flex items-center gap-1 text-xs text-gray-600 ${f.required ? 'opacity-40 pointer-events-none' : ''}`}><input type="checkbox" className="accent-indigo-600" checked={!!f.defaultOn} onChange={e => updFee(idx, { defaultOn: e.target.checked })} />{t.feeDefaultOn}</label>
                <button onClick={() => removeFee(idx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Tax (VAT) */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-1">{t.taxT}</h4>
          <p className="text-xs text-gray-500 mb-3">{t.taxHint}</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div><label className={lbl}>{t.taxRate}</label><input className={fld} type="number" value={draft.taxRate ?? ''} onChange={e => upd({ taxRate: parseFloat(e.target.value) || 0 })} placeholder="0" /></div>
            <div><label className={lbl}>{t.taxMode}</label><select className={fld + ' bg-white'} value={draft.taxInclusive ? 'incl' : 'excl'} onChange={e => upd({ taxInclusive: e.target.value === 'incl' })}><option value="excl">{t.taxExcl}</option><option value="incl">{t.taxIncl}</option></select></div>
            <div><label className={lbl}>{t.taxLabelF}</label><input className={fld} value={draft.taxLabel || ''} onChange={e => upd({ taxLabel: e.target.value })} placeholder={T ? 'مالیات بر ارزش افزوده' : ''} /></div>
            <div><label className={lbl}>{t.taxLabelEnF}</label><input className={fld + ' dir-ltr'} value={draft.taxLabelEn || ''} onChange={e => upd({ taxLabelEn: e.target.value })} placeholder="VAT" /></div>
          </div>
        </div>
      </div>

      {/* Discount codes */}
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

      {/* Products */}
      <div className={card}>
        <datalist id={`ms-cats-${draft.id}`}>
          {Array.from(new Set(draft.products.map(p => p.group).filter(Boolean))).map(g => <option key={g} value={g as string} />)}
        </datalist>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-gray-700">{t.productsT} <span className="text-xs text-gray-400">({draft.products.length})</span></h4>
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setImportText(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{t.importJson}</button>
            <button onClick={addProduct} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addProduct}</button>
          </div>
        </div>
        {draft.products.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">{t.noProducts}</p> : (
          <div className="space-y-3">
            {draft.products.map((p, idx) => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <ProductGallery images={p.images || []} onChange={imgs => updProduct(idx, { images: imgs })} lang={lang} />
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input className={fld + ' col-span-2'} placeholder={t.pName} value={p.name} onChange={e => updProduct(idx, { name: e.target.value })} />
                    <input className={fld + ' dir-ltr'} placeholder={t.pSku} value={p.sku || ''} onChange={e => updProduct(idx, { sku: e.target.value })} />
                    <input className={fld} placeholder={t.pGroup} value={p.group || ''} onChange={e => updProduct(idx, { group: e.target.value })} list={`ms-cats-${draft.id}`} />
                    <input className={fld} placeholder={t.pSubcat} value={p.subcategory || ''} onChange={e => updProduct(idx, { subcategory: e.target.value })} />
                    <input className={fld} type="number" placeholder={t.pPrice} value={p.price ?? ''} onChange={e => updProduct(idx, { price: parseFloat(e.target.value) || 0 })} />
                    {!isServices && <input className={fld} type="number" placeholder={t.pPack} value={p.packPrice ?? ''} onChange={e => updProduct(idx, { packPrice: parseFloat(e.target.value) || 0 })} />}
                    <input className={fld} placeholder={t.pUnit} value={p.unit || ''} onChange={e => updProduct(idx, { unit: e.target.value })} />
                    {isServices ? <input className={fld + ' col-span-1'} placeholder={T ? 'مثلا: روزانه' : 'e.g. per day'} value={p.priceUnit || ''} onChange={e => updProduct(idx, { priceUnit: e.target.value })} /> : <input className={fld} type="number" placeholder={t.pPackSize} value={p.pack ?? ''} onChange={e => updProduct(idx, { pack: parseFloat(e.target.value) || undefined })} />}
                    {!isServices && <input className={fld} placeholder={t.pMoq} value={p.moq || ''} onChange={e => updProduct(idx, { moq: e.target.value })} />}
                    <input className={fld} placeholder={t.pStock} value={p.stockLabel || ''} onChange={e => updProduct(idx, { stockLabel: e.target.value })} />
                    <textarea className={fld + ' col-span-2 md:col-span-4'} rows={1} placeholder={t.pDesc} value={p.description || ''} onChange={e => updProduct(idx, { description: e.target.value })} />
                    <input className={fld + ' col-span-2 md:col-span-4 dir-ltr'} placeholder={t.pVideo} value={p.videoUrl || ''} onChange={e => updProduct(idx, { videoUrl: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" className="accent-indigo-600" checked={p.active !== false} onChange={e => updProduct(idx, { active: e.target.checked })} />{t.active}</label>
                    {shopLangs().length > 0 && <button onClick={() => setTransOpen(s => ({ ...s, [p.id]: !s[p.id] }))} className={`text-[10px] px-1.5 py-0.5 rounded mt-1 ${transOpen[p.id] ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`} title={t.transBtn}>🌐 {t.transBtn}</button>}
                    <button onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-600 mt-1"><IconTrash className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Per-language translations */}
                {transOpen[p.id] && shopLangs().length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                    {shopLangs().filter(l => l.code).map(lg => (
                      <div key={lg.code} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500 w-20 shrink-0">{t.transFor} {lg.name || lg.code}</span>
                        <input className={fld} placeholder={t.pName} value={p.i18n?.[lg.code]?.name || ''} onChange={e => updProductI18n(idx, lg.code, 'name', e.target.value)} />
                        <input className={fld} placeholder={t.pDesc} value={p.i18n?.[lg.code]?.description || ''} onChange={e => updProductI18n(idx, lg.code, 'description', e.target.value)} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Rate options (max 3) */}
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
                          <input className={fld + ' max-w-[110px]'} type="number" placeholder={t.optPrice} value={o.price ?? ''} onChange={e => updRate(idx, oIdx, { price: parseFloat(e.target.value) || 0 })} />
                          <button onClick={() => removeRate(idx, oIdx)} className="text-red-400 hover:text-red-600 shrink-0"><IconTrash className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <input className={fld} placeholder={t.pgLabel} value={pg.label} onChange={e => updPage(idx, { label: e.target.value })} />
                  <input className={fld + ' dir-ltr'} placeholder={t.pgLabelEn} value={pg.labelEn || ''} onChange={e => updPage(idx, { labelEn: e.target.value })} />
                </div>

                {pg.type === 'text' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <textarea className={fld} rows={5} placeholder={t.pgBody} value={pg.body || ''} onChange={e => updPage(idx, { body: e.target.value })} />
                    <textarea className={fld + ' dir-ltr'} rows={5} placeholder={t.pgBodyEn} value={pg.bodyEn || ''} onChange={e => updPage(idx, { bodyEn: e.target.value })} />
                  </div>
                )}
                {(pg.type === 'gallery' || pg.type === 'cards') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <input className={fld} placeholder={t.pgDesc} value={pg.description || ''} onChange={e => updPage(idx, { description: e.target.value })} />
                    <input className={fld + ' dir-ltr'} placeholder={t.pgDescEn} value={pg.descriptionEn || ''} onChange={e => updPage(idx, { descriptionEn: e.target.value })} />
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
                      <PageImageUploader onUpload={url => addPageImage(idx, url)} />
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
                          <CardImageUploader image={c.image} onUpload={url => updCard(idx, cIdx, { image: url })} onClear={() => updCard(idx, cIdx, { image: '' })} />
                          <div className="flex-1 grid grid-cols-2 gap-1.5">
                            <input className={fld} placeholder={t.cardName} value={c.name || ''} onChange={e => updCard(idx, cIdx, { name: e.target.value })} />
                            <input className={fld + ' dir-ltr'} placeholder={t.cardNameEn} value={c.nameEn || ''} onChange={e => updCard(idx, cIdx, { nameEn: e.target.value })} />
                            <textarea className={fld} rows={1} placeholder={t.cardDesc} value={c.desc || ''} onChange={e => updCard(idx, cIdx, { desc: e.target.value })} />
                            <textarea className={fld + ' dir-ltr'} rows={1} placeholder={t.cardDescEn} value={c.descEn || ''} onChange={e => updCard(idx, cIdx, { descEn: e.target.value })} />
                          </div>
                          <button onClick={() => removeCard(idx, cIdx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
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
      <input type="file" ref={updateFileRef} className="hidden" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f && updateShop) updateShopFromFile(updateShop, f); e.target.value = ''; setUpdateShop(null); }} />
    </div>
  );
};

// Page image adder (upload OR paste URL)
const PageImageUploader: React.FC<{ onUpload: (url: string) => void }> = ({ onUpload }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const [url, setUrl] = useState('');
  return (
    <div className="flex flex-col gap-1 w-16">
      <div onClick={() => !up && ref.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-center text-gray-300">
        {up ? <span className="text-[9px]">...</span> : <IconUpload className="w-4 h-4" />}
      </div>
      <div className="flex gap-0.5">
        <input className="flex-1 min-w-0 px-1 py-0.5 rounded border border-gray-200 text-[9px] outline-none dir-ltr" placeholder="URL" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (url.trim()) { onUpload(url.trim()); setUrl(''); } } }} />
        <button onClick={() => { if (url.trim()) { onUpload(url.trim()); setUrl(''); } }} disabled={!url.trim()} className="px-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-500"><IconPlus className="w-2.5 h-2.5" /></button>
      </div>
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setUp(true); uploadFileWithProgress(f, () => {}, u => { onUpload(u); setUp(false); }, err => { alert(err.message); setUp(false); }, 'images'); } e.target.value = ''; }} />
    </div>
  );
};

// Card image (upload OR paste URL)
const CardImageUploader: React.FC<{ image?: string; onUpload: (url: string) => void; onClear: () => void }> = ({ image, onUpload, onClear }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const [url, setUrl] = useState('');
  return (
    <div className="shrink-0 w-12">
      <div onClick={() => !up && ref.current?.click()} className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 bg-white hover:bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center text-gray-300">
        {image ? <img src={image} className="w-full h-full object-contain" /> : (up ? <span className="text-[8px]">...</span> : <IconUpload className="w-3.5 h-3.5" />)}
      </div>
      {image ? <button onClick={onClear} className="text-[9px] text-red-400 w-full text-center">✕</button>
        : <input className="w-12 mt-0.5 px-1 py-0.5 rounded border border-gray-200 text-[8px] outline-none dir-ltr" placeholder="URL" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim()) { e.preventDefault(); onUpload(url.trim()); setUrl(''); } }} onBlur={() => { if (url.trim()) { onUpload(url.trim()); setUrl(''); } }} />}
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setUp(true); uploadFileWithProgress(f, () => {}, u => { onUpload(u); setUp(false); }, err => { alert(err.message); setUp(false); }, 'images'); } e.target.value = ''; }} />
    </div>
  );
};

// Multi-image gallery uploader for a product (upload several OR paste image URLs; first = main)
const ProductGallery: React.FC<{ images: string[]; onChange: (imgs: string[]) => void; lang: Language }> = ({ images, onChange, lang }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const [url, setUrl] = useState('');
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setUp(true);
    let remaining = arr.length;
    const collected: string[] = [];
    const done = () => { if (--remaining === 0) { onChange([...images, ...collected]); setUp(false); } };
    arr.forEach(f => uploadFileWithProgress(f, () => {}, u => { collected.push(u); done(); }, err => { alert(err.message); done(); }, 'images'));
  };
  const addUrl = () => { const u = url.trim(); if (!u) return; onChange([...images, u]); setUrl(''); };
  return (
    <div className="shrink-0 w-[150px]">
      <div className="grid grid-cols-4 gap-1">
        {images.map((src, i) => (
          <div key={i} className="relative w-[34px] h-[34px] rounded overflow-hidden border border-gray-200 group">
            <img src={src} className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-indigo-600/80 text-white text-[6px] text-center leading-tight">{lang === 'fa' ? 'اصلی' : 'main'}</span>}
            <button onClick={() => onChange(images.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-red-500 text-white text-[8px] w-3 h-3 leading-none opacity-0 group-hover:opacity-100">✕</button>
          </div>
        ))}
        <div onClick={() => !up && ref.current?.click()} className="w-[34px] h-[34px] rounded border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-center text-gray-300" title={lang === 'fa' ? 'آپلود' : 'Upload'}>
          {up ? <span className="text-[8px]">...</span> : <IconUpload className="w-3 h-3" />}
        </div>
      </div>
      <div className="flex gap-1 mt-1">
        <input className="flex-1 min-w-0 px-1.5 py-1 rounded border border-gray-200 text-[10px] outline-none dir-ltr" placeholder={lang === 'fa' ? 'لینک عکس' : 'image URL'} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        <button onClick={addUrl} disabled={!url.trim()} className="px-1.5 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-500 shrink-0"><IconPlus className="w-3 h-3" /></button>
      </div>
      <input type="file" ref={ref} className="hidden" accept="image/*" multiple onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
};
