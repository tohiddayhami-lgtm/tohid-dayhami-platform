import React, { useState, useMemo, useRef } from 'react';
import { MetaShop, MetaShopProduct, MetaShopOrder, MetaShopType, Personnel, AppConfig, Department } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconCopy, IconLink, IconSearch, IconUsers, IconSettings, IconUpload, IconGlobe, IconTag } from './Icons';
import { uploadFileWithProgress } from '../services/firebaseService';
import { downloadSample } from './metaShopSamples';
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

export const MetaShopManager: React.FC<Props> = ({ metaShops, metaShopOrders, personnel, config, lang, shopBaseUrl, onSaveMetaShop, onDeleteMetaShop, onUpdateMetaShopOrder, readonly = false }) => {
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
  const T = lang === 'fa';
  const departments: Department[] = config.departments || [];

  const t = {
    title: T ? 'متاشاپ' : 'Meta Shop', subtitle: T ? 'فروشگاه‌های آنلاین شما' : 'Your online shops',
    newShop: T ? 'فروشگاه جدید' : 'New Shop', importJson: T ? 'ساخت از JSON' : 'Import from JSON',
    empty: T ? 'هنوز فروشگاهی نساخته‌اید.' : 'No shops yet.',
    edit: T ? 'ویرایش' : 'Edit', del: T ? 'حذف' : 'Delete', open: T ? 'باز کردن' : 'Open', copy: T ? 'کپی لینک' : 'Copy link', copied: T ? 'کپی شد ✓' : 'Copied ✓',
    orders: T ? 'سفارش‌ها' : 'Orders', active: T ? 'فعال' : 'Active', inactive: T ? 'غیرفعال' : 'Inactive',
    back: T ? 'بازگشت' : 'Back', save: T ? 'ذخیره فروشگاه' : 'Save shop', cancel: T ? 'انصراف' : 'Cancel',
    basics: T ? 'اطلاعات پایه' : 'Basics', theme: T ? 'رنگ‌بندی قالب' : 'Theme', cover: T ? 'کاور و معرفی' : 'Cover & intro',
    contact: T ? 'تماس و فوتر' : 'Contact & footer', routing: T ? 'ارجاع سفارش‌ها' : 'Order routing', productsT: T ? 'محصولات / خدمات' : 'Products / Services',
    name: T ? 'نام فروشگاه' : 'Shop name', slug: T ? 'شناسه لینک (slug)' : 'Link slug', type: T ? 'نوع' : 'Type',
    typeProducts: T ? 'محصولات' : 'Products', typeServices: T ? 'خدمات' : 'Services', currency: T ? 'واحد پول' : 'Currency',
    defLang: T ? 'زبان پیش‌فرض نمایش' : 'Default display language', langFa: T ? 'فارسی' : 'Persian', langEn: T ? 'انگلیسی' : 'English',
    pagesT: T ? 'صفحات و تب‌ها' : 'Pages & Tabs', pagesHint: T ? 'تب‌های اضافی فروشگاه مثل «درباره ما» یا «گواهینامه‌ها». تب «محصولات/خدمات» همیشه هست.' : 'Extra shop tabs like About Us or Certifications. The products tab is always present.',
    addPage: T ? 'افزودن صفحه' : 'Add page', noPages: T ? 'صفحه‌ای اضافه نشده است.' : 'No pages added.',
    pgLabel: T ? 'عنوان تب (فارسی)' : 'Tab label (FA)', pgLabelEn: T ? 'عنوان تب (انگلیسی)' : 'Tab label (EN)', pgType: T ? 'نوع صفحه' : 'Page type',
    pgText: T ? 'متن + تصویر' : 'Text + images', pgGallery: T ? 'گالری عکس' : 'Photo gallery', pgCards: T ? 'کارت‌ها (گواهینامه/شرکا)' : 'Cards (certs/partners)',
    pgBody: T ? 'متن (فارسی)' : 'Body (FA)', pgBodyEn: T ? 'متن (انگلیسی)' : 'Body (EN)', pgDesc: T ? 'توضیح (فارسی)' : 'Description (FA)', pgDescEn: T ? 'توضیح (انگلیسی)' : 'Description (EN)',
    pgImages: T ? 'تصاویر' : 'Images', pgAddImg: T ? 'افزودن تصویر' : 'Add image', pgCardsList: T ? 'کارت‌ها' : 'Cards', pgAddCard: T ? 'افزودن کارت' : 'Add card',
    cardName: T ? 'عنوان (فارسی)' : 'Name (FA)', cardNameEn: T ? 'عنوان (انگلیسی)' : 'Name (EN)', cardDesc: T ? 'توضیح (فارسی)' : 'Desc (FA)', cardDescEn: T ? 'توضیح (انگلیسی)' : 'Desc (EN)',
    productsTabLabel: T ? 'عنوان تب محصولات (فارسی)' : 'Products tab label (FA)', productsTabLabelEn: T ? 'عنوان تب محصولات (انگلیسی)' : 'Products tab label (EN)',
    moveUp: T ? 'بالا' : 'Up', moveDown: T ? 'پایین' : 'Down',
    primary: T ? 'رنگ اصلی' : 'Primary', coverC: T ? 'رنگ کاور' : 'Cover', coverText: T ? 'متن کاور' : 'Cover text', bg: T ? 'پس‌زمینه' : 'Background',
    collection: T ? 'متن بالای عنوان' : 'Collection text', heroTitle: T ? 'عنوان اصلی' : 'Title', heroSub: T ? 'زیرعنوان' : 'Subtitle',
    coverImg: T ? 'تصویر کاور' : 'Cover image', logo: T ? 'لوگو' : 'Logo', upload: T ? 'آپلود' : 'Upload', uploading: T ? 'در حال آپلود...' : 'Uploading...',
    phone: T ? 'تلفن' : 'Phone', email: T ? 'ایمیل' : 'Email', website: T ? 'وب‌سایت' : 'Website', address: T ? 'آدرس' : 'Address', footer: T ? 'متن فوتر' : 'Footer text',
    thanksTxt: T ? 'متن تشکر پس از سفارش' : 'Order thank-you text', cartBtn: T ? 'متن دکمه سفارش' : 'Order button text',
    routeHint: T ? 'سفارش‌های این فروشگاه به کارتابل چه کسانی برود؟' : 'Whose cartable should orders go to?',
    routePersonnel: T ? 'پرسنل مشخص' : 'Specific personnel', routeDept: T ? 'یک دپارتمان' : 'A department', routeNone: T ? 'پیش‌فرض (مستر)' : 'Default (master)',
    addProduct: T ? 'افزودن مورد' : 'Add item', noProducts: T ? 'موردی اضافه نشده است.' : 'No items added.',
    pName: T ? 'نام' : 'Name', pSku: T ? 'کد (SKU)' : 'SKU', pGroup: T ? 'دسته' : 'Category', pPrice: T ? 'قیمت' : 'Price', pPack: T ? 'قیمت بسته' : 'Pack price',
    pUnit: T ? 'واحد' : 'Unit', pPackSize: T ? 'تعداد در بسته' : 'Pack size', pMoq: T ? 'حداقل سفارش' : 'MOQ', pStock: T ? 'وضعیت موجودی' : 'Stock label', pDesc: T ? 'توضیحات' : 'Description', pImg: T ? 'تصویر' : 'Image',
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

  const startNew = () => { setDraft(blankShop()); setMode('editor'); };
  const startEdit = (s: MetaShop) => { setDraft(JSON.parse(JSON.stringify(s))); setMode('editor'); };
  const upd = (patch: Partial<MetaShop>) => setDraft(d => d ? { ...d, ...patch } : d);
  const updTheme = (patch: Partial<MetaShop['theme']>) => setDraft(d => d ? { ...d, theme: { ...d.theme, ...patch } } : d);

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
  if (mode === 'list') {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><IconTag className="w-5 h-5" /></div>
            <div><h3 className="text-lg font-bold text-gray-800">{t.title}</h3><p className="text-xs text-gray-400">{t.subtitle} ({metaShops.length})</p></div>
          </div>
          {!readonly && <div className="flex items-center gap-2">
            <button onClick={() => { setImportOpen(true); setImportText(''); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"><IconUpload className="w-4 h-4" />{t.importJson}</button>
            <button onClick={startNew} className="px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><IconPlus className="w-4 h-4" />{t.newShop}</button>
          </div>}
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
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[220px]">{o.items.map((it, i) => <div key={i} className="truncate">{it.name} × {it.qty}</div>)}{o.notes && <div className="text-[11px] text-gray-400 mt-1 italic">📝 {o.notes}</div>}</td>
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
          <div><label className={lbl}>{t.defLang}</label><select className={fld + ' bg-white'} value={draft.defaultLang || 'fa'} onChange={e => upd({ defaultLang: e.target.value as 'fa' | 'en' })}><option value="fa">{t.langFa}</option><option value="en">{t.langEn}</option></select></div>
          <div><label className={lbl}>{t.productsTabLabel}</label><input className={fld} value={draft.productsTabLabel || ''} onChange={e => upd({ productsTabLabel: e.target.value })} placeholder={draft.type === 'services' ? 'خدمات' : 'محصولات'} /></div>
          <div><label className={lbl}>{t.productsTabLabelEn}</label><input className={fld + ' dir-ltr'} value={draft.productsTabLabelEn || ''} onChange={e => upd({ productsTabLabelEn: e.target.value })} placeholder={draft.type === 'services' ? 'Services' : 'Product List'} /></div>
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
            <div className="flex items-center gap-2">
              {draft.coverImage && <img src={draft.coverImage} className="w-14 h-10 object-cover rounded border" />}
              <button onClick={() => coverInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex items-center gap-1"><IconUpload className="w-4 h-4" />{t.upload}</button>
              {draft.coverImage && <button onClick={() => upd({ coverImage: '' })} className="text-red-400"><IconTrash className="w-4 h-4" /></button>}
              <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ coverImage: url })); }} />
            </div>
          </div>
          <div><label className={lbl}>{t.logo}</label>
            <div className="flex items-center gap-2">
              {draft.logo && <img src={draft.logo} className="w-10 h-10 object-contain rounded border" />}
              <button onClick={() => logoInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex items-center gap-1"><IconUpload className="w-4 h-4" />{t.upload}</button>
              {draft.logo && <button onClick={() => upd({ logo: '' })} className="text-red-400"><IconTrash className="w-4 h-4" /></button>}
              <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ logo: url })); }} />
            </div>
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

      {/* Products */}
      <div className={card}>
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
                  <ProductImage product={p} onUpload={(url) => updProduct(idx, { images: [url, ...(p.images || []).slice(1)] })} onClear={() => updProduct(idx, { images: [] })} lang={lang} />
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input className={fld + ' col-span-2'} placeholder={t.pName} value={p.name} onChange={e => updProduct(idx, { name: e.target.value })} />
                    <input className={fld + ' dir-ltr'} placeholder={t.pSku} value={p.sku || ''} onChange={e => updProduct(idx, { sku: e.target.value })} />
                    <input className={fld} placeholder={t.pGroup} value={p.group || ''} onChange={e => updProduct(idx, { group: e.target.value })} />
                    <input className={fld} type="number" placeholder={t.pPrice} value={p.price ?? ''} onChange={e => updProduct(idx, { price: parseFloat(e.target.value) || 0 })} />
                    {!isServices && <input className={fld} type="number" placeholder={t.pPack} value={p.packPrice ?? ''} onChange={e => updProduct(idx, { packPrice: parseFloat(e.target.value) || 0 })} />}
                    <input className={fld} placeholder={t.pUnit} value={p.unit || ''} onChange={e => updProduct(idx, { unit: e.target.value })} />
                    {isServices ? <input className={fld + ' col-span-1'} placeholder={T ? 'مثلا: روزانه' : 'e.g. per day'} value={p.priceUnit || ''} onChange={e => updProduct(idx, { priceUnit: e.target.value })} /> : <input className={fld} type="number" placeholder={t.pPackSize} value={p.pack ?? ''} onChange={e => updProduct(idx, { pack: parseFloat(e.target.value) || undefined })} />}
                    {!isServices && <input className={fld} placeholder={t.pMoq} value={p.moq || ''} onChange={e => updProduct(idx, { moq: e.target.value })} />}
                    <input className={fld} placeholder={t.pStock} value={p.stockLabel || ''} onChange={e => updProduct(idx, { stockLabel: e.target.value })} />
                    <textarea className={fld + ' col-span-2 md:col-span-4'} rows={1} placeholder={t.pDesc} value={p.description || ''} onChange={e => updProduct(idx, { description: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" className="accent-indigo-600" checked={p.active !== false} onChange={e => updProduct(idx, { active: e.target.checked })} />{t.active}</label>
                    <button onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-600 self-center mt-1"><IconTrash className="w-4 h-4" /></button>
                  </div>
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
    </div>
  );
};

// Page image uploader (adds to a list)
const PageImageUploader: React.FC<{ onUpload: (url: string) => void }> = ({ onUpload }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  return (
    <>
      <div onClick={() => !up && ref.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-center text-gray-300">
        {up ? <span className="text-[9px]">...</span> : <IconUpload className="w-4 h-4" />}
      </div>
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setUp(true); uploadFileWithProgress(f, () => {}, url => { onUpload(url); setUp(false); }, err => { alert(err.message); setUp(false); }, 'images'); } e.target.value = ''; }} />
    </>
  );
};

// Card image uploader (single image)
const CardImageUploader: React.FC<{ image?: string; onUpload: (url: string) => void; onClear: () => void }> = ({ image, onUpload, onClear }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  return (
    <div className="shrink-0">
      <div onClick={() => !up && ref.current?.click()} className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 bg-white hover:bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center text-gray-300">
        {image ? <img src={image} className="w-full h-full object-contain" /> : (up ? <span className="text-[8px]">...</span> : <IconUpload className="w-3.5 h-3.5" />)}
      </div>
      {image && <button onClick={onClear} className="text-[9px] text-red-400 w-full text-center">✕</button>}
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setUp(true); uploadFileWithProgress(f, () => {}, url => { onUpload(url); setUp(false); }, err => { alert(err.message); setUp(false); }, 'images'); } e.target.value = ''; }} />
    </div>
  );
};

// Small product-image uploader
const ProductImage: React.FC<{ product: MetaShopProduct; onUpload: (url: string) => void; onClear: () => void; lang: Language }> = ({ product, onUpload, onClear, lang }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const img = product.images && product.images[0];
  return (
    <div className="shrink-0">
      <div onClick={() => !up && ref.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center text-gray-300">
        {img ? <img src={img} className="w-full h-full object-cover" /> : (up ? <span className="text-[9px]">...</span> : <IconUpload className="w-4 h-4" />)}
      </div>
      {img && <button onClick={onClear} className="text-[10px] text-red-400 mt-1 w-full text-center">{lang === 'fa' ? 'حذف' : 'clear'}</button>}
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setUp(true); uploadFileWithProgress(f, () => {}, url => { onUpload(url); setUp(false); }, err => { alert(err.message); setUp(false); }, 'images'); } }} />
    </div>
  );
};
