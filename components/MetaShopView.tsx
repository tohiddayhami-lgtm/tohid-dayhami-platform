import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MetaShop, MetaShopProduct, MetaShopOrder, MetaShopPage } from '../types';
import { shopCodeOf } from './shopCode';
import { productMatchesSearch } from '../utils/metaShopSearch';
import { logMetaShopEvent, uploadFileWithProgress } from '../services/firebaseService';
import { Language } from '../App';
import { dealTypeLabel, propertyTypeLabel, realEstateCardSummary, realEstateDetailRows, realEstateFaqText, realEstateFaqs, resolveReText, formatMoney, DEAL_TYPE_LABEL, PROPERTY_TYPE_LABEL } from '../utils/metaShopRealEstate';
import { resolveShopLanguages, isRtlLang, localeForLang, legacyBilingual, translateField, translateStockLabel, uiString } from '../utils/metaShopLang';
import { resolvePropertyContact, telHref, waHref, openTel, openWhatsApp } from '../utils/metaShopContact';
import { normalizeShopCategories, categoryLabel, findCategoryEntry, translateProductGroup, translateProductSubcategory } from '../utils/metaShopCategories';

interface OrderData {
  customerName: string; company?: string; phone: string; email?: string;
  country?: string; city?: string; notes?: string;
  items: { productId: string; name: string; sku?: string; unit?: string; qty: number; unitPrice?: number; lineTotal?: number; currency?: string; optionLabel?: string }[];
  fees?: { label: string; amount: number }[];
  itemsTotal?: number;
  discountCode?: string;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  taxInclusive?: boolean;
  total: number; currency: string;
}

export interface MetaShopReferralSubmit {
  referrerName: string;
  referrerPhone: string;
  referrerEmail?: string;
  relation?: string;
  propertyTitle?: string;
  dealType?: string;
  propertyType?: string;
  city?: string;
  district?: string;
  areaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  monthlyRent?: number;
  deposit?: number;
  description?: string;
  notes?: string;
  images: string[];
}

interface Props {
  shop: MetaShop;
  lang: Language;
  onSubmitOrder: (data: OrderData) => Promise<string>; // returns tracking code
  onSubmitReferral?: (data: MetaShopReferralSubmit) => Promise<string>;
  onLookup?: (criteria: { phone?: string; trackingCode?: string; name?: string }) => Promise<MetaShopOrder[]>;
  embed?: boolean; // rendered inside an iframe (Google Sites / external site embed) — slightly compacts chrome
}

const CartIcon = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);
const PdfIcon = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>
);

const ChevronIcon = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'prev' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
  </svg>
);

/** Horizontal pill strip with prev/next controls when categories overflow the viewport. */
const ScrollPillRow: React.FC<{
  barClassName: string;
  activeId?: string;
  children: React.ReactNode;
}> = ({ barClassName, activeId, children }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const refreshEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const pills = Array.from(el.querySelectorAll<HTMLElement>('[data-pill-id]'));
    if (!pills.length) { setEdges({ start: false, end: false }); return; }
    const box = el.getBoundingClientRect();
    const fullyVisible = (r: DOMRect) => r.left >= box.left - 2 && r.right <= box.right + 2;
    const first = pills[0].getBoundingClientRect();
    const last = pills[pills.length - 1].getBoundingClientRect();
    setEdges({
      start: !fullyVisible(first),
      end: !fullyVisible(last),
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    refreshEdges();
    el.addEventListener('scroll', refreshEdges, { passive: true });
    const ro = new ResizeObserver(refreshEdges);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', refreshEdges); ro.disconnect(); };
  }, [refreshEdges, children]);

  useEffect(() => {
    if (!activeId || !scrollerRef.current) return;
    const btn = scrollerRef.current.querySelector<HTMLElement>(`[data-pill-id="${CSS.escape(activeId)}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const t = window.setTimeout(refreshEdges, 320);
    return () => window.clearTimeout(t);
  }, [activeId, refreshEdges]);

  const scrollStep = (forward: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    const pills = Array.from(el.querySelectorAll<HTMLElement>('[data-pill-id]'));
    const box = el.getBoundingClientRect();
    const visible = pills.filter(p => {
      const r = p.getBoundingClientRect();
      return r.right > box.left + 2 && r.left < box.right - 2;
    });
    if (!visible.length) return;
    const anchor = forward ? visible[visible.length - 1] : visible[0];
    const idx = pills.indexOf(anchor);
    const target = forward ? pills[idx + 1] : pills[idx - 1];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: forward ? 'end' : 'start' });
    else el.scrollBy({ left: forward ? box.width * 0.75 : -box.width * 0.75, behavior: 'smooth' });
    window.setTimeout(refreshEdges, 320);
  };

  const showArrows = edges.start || edges.end;

  return (
    <div className="ms-pill-scroll">
      {showArrows && (
        <button type="button" className={`ms-pill-arrow ${!edges.start ? 'disabled' : ''}`} disabled={!edges.start} onClick={() => scrollStep(false)} aria-label="Previous categories">
          <ChevronIcon dir="prev" />
        </button>
      )}
      <div className={`ms-pill-scroll-track${edges.start ? ' fade-start' : ''}${edges.end ? ' fade-end' : ''}`}>
        <div ref={scrollerRef} className={barClassName}>{children}</div>
      </div>
      {showArrows && (
        <button type="button" className={`ms-pill-arrow ${!edges.end ? 'disabled' : ''}`} disabled={!edges.end} onClick={() => scrollStep(true)} aria-label="Next categories">
          <ChevronIcon dir="next" />
        </button>
      )}
    </div>
  );
};

export const MetaShopView: React.FC<Props> = ({ shop, lang, onSubmitOrder, onSubmitReferral, onLookup, embed }) => {
  const isServices = shop.type === 'services';
  const isRealEstate = shop.type === 'realestate';
  const [cart, setCart] = useState<Record<string, { qty: number; optionId?: string }>>({});
  const [activeCat, setActiveCat] = useState<string>('all');
  const [activeSub, setActiveSub] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<MetaShopProduct | null>(null);
  const [galIdx, setGalIdx] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'review'>('cart');
  const [chosenOpt, setChosenOpt] = useState<Record<string, string>>({}); // productId -> selected rate option id
  const [selectedFees, setSelectedFees] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    (shop.extraFees || []).forEach(f => { init[f.id] = f.required ? true : !!f.defaultOn; });
    return init;
  });
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<import('../types').MetaShopDiscount | null>(null);
  const [discountErr, setDiscountErr] = useState('');
  useEffect(() => { setGalIdx(0); }, [detail]);
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detail]);
  // Record a visit (once per session per shop) for the shop's visit report.
  useEffect(() => { logMetaShopEvent('visit', { id: shop.id, name: shop.name }, { via: embed ? 'gsite' : 'shop' }); }, [shop.id]);

  // Resolve a product video URL into an embeddable form
  const videoEmbed = (url?: string): { type: 'iframe' | 'video' | 'link'; src: string } | null => {
    if (!url || !url.trim()) return null;
    const u = url.trim();
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
    const vm = u.match(/vimeo\.com\/(\d+)/);
    if (vm) return { type: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}` };
    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u)) return { type: 'video', src: u };
    return { type: 'link', src: u };
  };
  const [form, setForm] = useState({ customerName: '', company: '', phone: '', email: '', country: '', city: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupName, setLookupName] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResults, setLookupResults] = useState<MetaShopOrder[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [inquiryProp, setInquiryProp] = useState<MetaShopProduct | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ customerName: '', phone: '', email: '', visitWhen: '', notes: '' });
  const [referOpen, setReferOpen] = useState(false);
  const [referTracking, setReferTracking] = useState<string | null>(null);
  const [referImages, setReferImages] = useState<string[]>([]);
  const [referUploading, setReferUploading] = useState(false);
  const referFileRef = useRef<HTMLInputElement>(null);
  const emptyReferForm = () => ({
    referrerName: '', referrerPhone: '', referrerEmail: '', relation: 'owner',
    propertyTitle: '', dealType: 'sale', propertyType: 'apartment',
    city: '', district: '', areaSqm: '', bedrooms: '', bathrooms: '',
    price: '', monthlyRent: '', deposit: '', description: '', notes: '',
  });
  const [referForm, setReferForm] = useState(emptyReferForm);
  const [inquiryTracking, setInquiryTracking] = useState<string | null>(null);
  // Supported languages — whatever is configured on the shop (defaults only when empty)
  const langs = resolveShopLanguages(shop);
  const isRtl = (code: string) => isRtlLang(code, langs);
  const [uiLang, setUiLang] = useState<string>(() => {
    const preferred = shop.defaultLang || langs[0]?.code || lang;
    return langs.some(l => l.code === preferred) ? preferred : (langs[0]?.code || lang);
  });
  const [tab, setTab] = useState<string>('products');

  const dir: 'rtl' | 'ltr' = isRtl(uiLang) ? 'rtl' : 'ltr';
  const locale = localeForLang(uiLang);
  const pages = shop.pages || [];

  const reLang = () => uiLang;

  const L = (faVal?: string, enVal?: string) => legacyBilingual(uiLang, faVal, enVal);
  const TR = (i18n: Record<string, Record<string, string>> | undefined, key: string, legacy: string) =>
    translateField(i18n, key, legacy, uiLang);

  // ── UI chrome strings per language (en is the fallback for any missing key/language) ──
  const STRINGS: Record<string, Record<string, string>> = {
    en: {
      cartBtn: 'Place Order', addProduct: 'Add to cart', addService: 'Add to request', added: 'Added ✓', all: 'All',
      searchPh: 'Search products...', empty: 'No items found.', cartTitle: 'Your Order', cartEmpty: 'No items yet.',
      qty: 'Qty', remove: 'Remove', total: 'Total', yourInfo: 'Your Information', name: 'Full Name', company: 'Company',
      phone: 'Mobile / WhatsApp', email: 'Email', country: 'Country', city: 'City / Destination', notes: 'Notes / Special requests',
      submit: 'Submit Order', submitting: 'Submitting...', incomplete: 'Please enter your name and phone.', err: 'Failed to submit. Please try again.',
      thanksTitle: 'Order received!', thanksDesc: 'Your order has been received. Keep your tracking code below — we will contact you shortly.',
      trackingCode: 'Order tracking code', copy: 'Copy', copied: 'Copied', close: 'Close', trackMy: 'Track my orders', trackBtn: 'View',
      trackCodePh: 'Tracking code', trackHint: 'Search by tracking code, or by phone — add your name to narrow it down.', trackNeed: 'Enter a tracking code or phone number.',
      noOrders: 'No orders found. Check your tracking code, phone or name.', moq: 'MOQ', pack: 'Pack', statusNew: 'New', statusProg: 'In progress', statusDone: 'Done', statusCanc: 'Cancelled',
      perPack: '/ pack', review: 'Continue to invoice preview', invoiceTitle: 'Invoice preview', editCart: 'Edit cart',
      featured: 'Featured', featuredTitle: 'Featured products', negotiable: 'Negotiable — request a quote',
      outOfStock: 'Currently unavailable',
      colItem: 'Item', colQty: 'Qty', colUnit: 'Unit price', colLine: 'Amount', invHint: 'This is a proforma preview; the final amount is confirmed after review.',
      confirm: 'Confirm & submit order', tabProducts: 'Product List', tabServices: 'Services', subtotalLabel: 'Items subtotal',
      feesLabel: 'Additional fees', optionalFee: '(optional)', discountTitle: 'Discount code', discountPh: 'Enter discount code', apply: 'Apply',
      discountLine: 'Discount', taxIncl: 'incl. tax', taxExcl: 'Tax', footPhone: 'Phone:', footEmail: 'Email:', footWebsite: 'Website:',
      catalog: 'PDF Catalog', downloadCatalog: 'Download PDF Catalog',
      addProperty: 'Request viewing', tabRealEstate: 'Properties', monthlyRent: 'Monthly rent', deposit: 'Deposit',
      specs: 'Specifications', faqTitle: 'FAQ', viewMap: 'View on map', virtualTour: 'Virtual tour', forSale: 'For sale',
      inquiryBtn: 'Request viewing', inquiryTitle: 'Property viewing request', visitWhen: 'Preferred visit time',
      inquirySubmit: 'Submit request', inquiryThanks: 'Request received!', trackInquiries: 'Track my requests',
      featuredProperties: 'Featured properties', callAgent: 'Call', whatsappAgent: 'WhatsApp', footWhatsapp: 'WhatsApp:',
      priceDisplayOnly: 'Listed price (informational)',
      inquiryAsideHint: 'Our agent will contact you after you submit.',
      inquiryFormHint: 'Enter your contact details to schedule a viewing.',
      namePh: 'Your full name', visitWhenPh: 'e.g. Saturday 10 AM', notesPhExtra: 'Any extra questions…',
      watchVideo: 'Watch video', pcs: 'pcs', offTag: ' off', cartEmptyErr: 'Cart is empty.',
      invalidDiscount: 'Invalid discount code.', minOrderDiscount: 'Minimum order for this code is',
      discountNoApply: 'This code does not apply to your cart items.',
      referProperty: 'Refer a property', referTitle: 'Refer a property to us',
      referHint: 'Own a home or know someone selling/renting? Share what you know — our team will review and contact you.',
      referSubmit: 'Submit referral', referThanks: 'Thank you!', referThanksDesc: 'Your referral was received. Keep the tracking code below — we will contact you after review.',
      referRelation: 'Your relation to the property', relOwner: 'I own it', relAcquaintance: 'I know the owner', relAgent: 'I am an agent', relOther: 'Other',
      propertyTitle: 'Property title (optional)', dealType: 'Deal type', propertyType: 'Property type', district: 'District / area',
      areaSqm: 'Area (m²)', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', price: 'Sale price (if known)', addPhotos: 'Add photos',
      uploading: 'Uploading…', photoLimit: 'Up to 8 photos', referNotes: 'Anything else you know',
    },
    fa: {
      cartBtn: 'ثبت سفارش', addProduct: 'افزودن به سبد', addService: 'افزودن به درخواست', added: 'افزوده شد ✓', all: 'همه',
      searchPh: 'جستجوی محصولات...', empty: 'موردی یافت نشد.', cartTitle: 'سبد سفارش شما', cartEmpty: 'هنوز موردی اضافه نشده است.',
      qty: 'تعداد', remove: 'حذف', total: 'جمع کل', yourInfo: 'اطلاعات شما', name: 'نام و نام خانوادگی', company: 'شرکت',
      phone: 'موبایل / واتس‌اپ', email: 'ایمیل', country: 'کشور', city: 'شهر / مقصد', notes: 'توضیحات و درخواست‌های ویژه',
      submit: 'ثبت نهایی سفارش', submitting: 'در حال ثبت...', incomplete: 'لطفاً نام و شماره موبایل را وارد کنید.', err: 'خطا در ثبت سفارش. دوباره تلاش کنید.',
      thanksTitle: 'سفارش شما ثبت شد!', thanksDesc: 'سفارش شما با موفقیت ثبت شد. کد رهگیری زیر را نزد خود نگه دارید؛ به‌زودی با شما تماس می‌گیریم.',
      trackingCode: 'کد رهگیری سفارش', copy: 'کپی', copied: 'کپی شد', close: 'بستن', trackMy: 'پیگیری سفارش‌های من', trackBtn: 'مشاهده',
      trackCodePh: 'شماره پیگیری', trackHint: 'با شماره پیگیری، یا با شماره موبایل جستجو کنید — برای دقیق‌تر شدن نام‌تان را هم وارد کنید.', trackNeed: 'شماره پیگیری یا شماره موبایل را وارد کنید.',
      noOrders: 'سفارشی یافت نشد. شماره پیگیری، موبایل یا نام را بررسی کنید.', moq: 'حداقل سفارش', pack: 'بسته', statusNew: 'جدید', statusProg: 'در حال انجام', statusDone: 'انجام شد', statusCanc: 'لغو شد',
      perPack: '/ بسته', review: 'ادامه و پیش‌نمایش فاکتور', invoiceTitle: 'پیش‌نمایش فاکتور', editCart: 'ویرایش سبد',
      featured: 'ویژه', featuredTitle: 'محصولات ویژه', negotiable: 'قابل مذاکره — درخواست قیمت',
      outOfStock: 'در حال حاضر موجود نیست',
      colItem: 'شرح', colQty: 'تعداد', colUnit: 'قیمت واحد', colLine: 'مبلغ', invHint: 'این یک پیش‌فاکتور است؛ مبلغ نهایی پس از بررسی تأیید می‌شود.',
      confirm: 'ثبت نهایی سفارش', tabProducts: 'محصولات', tabServices: 'خدمات', subtotalLabel: 'جمع اقلام',
      feesLabel: 'هزینه‌های اضافی', optionalFee: '(اختیاری)', discountTitle: 'کد تخفیف', discountPh: 'کد تخفیف را وارد کنید', apply: 'اعمال',
      discountLine: 'تخفیف', taxIncl: 'شامل مالیات', taxExcl: 'مالیات', footPhone: 'تلفن:', footEmail: 'ایمیل:', footWebsite: 'وب‌سایت:',
      catalog: 'کاتالوگ PDF', downloadCatalog: 'دانلود کاتالوگ PDF',
      addProperty: 'درخواست بازدید', tabRealEstate: 'املاک', monthlyRent: 'اجاره ماهانه', deposit: 'ودیعه',
      specs: 'مشخصات ملک', faqTitle: 'سوالات متداول', viewMap: 'مشاهده روی نقشه', virtualTour: 'تور مجازی', forSale: 'فروش',
      inquiryBtn: 'درخواست بازدید', inquiryTitle: 'درخواست بازدید ملک', visitWhen: 'زمان پیشنهادی بازدید',
      inquirySubmit: 'ثبت درخواست بازدید', inquiryThanks: 'درخواست شما ثبت شد!', trackInquiries: 'پیگیری درخواست‌ها',
      featuredProperties: 'املاک ویژه', callAgent: 'تماس', whatsappAgent: 'واتس‌اپ', footWhatsapp: 'واتس‌اپ:',
      priceDisplayOnly: 'قیمت اعلامی (فقط نمایش)',
      inquiryAsideHint: 'پس از ثبت، کارشناس املاک با شما تماس می‌گیرد.',
      inquiryFormHint: 'اطلاعات تماس خود را وارد کنید تا هماهنگی بازدید انجام شود.',
      namePh: 'نام کامل', visitWhenPh: 'مثلاً شنبه ۱۰ صبح', notesPhExtra: 'سوال یا توضیح اضافه…',
      watchVideo: 'تماشای ویدئو', pcs: 'عدد', offTag: ' تخفیف', cartEmptyErr: 'سبد خالی است.',
      invalidDiscount: 'کد تخفیف نامعتبر است.', minOrderDiscount: 'حداقل مبلغ سفارش برای این کد',
      discountNoApply: 'این کد برای اقلام سبد شما اعمال نمی‌شود.',
      referProperty: 'معرفی ملک', referTitle: 'معرفی ملک به ما',
      referHint: 'خانه‌ای دارید یا کسی را می‌شناسید که می‌خواهد بفروشد یا اجاره دهد؟ هر اطلاعی که دارید بنویسید — پس از بررسی با شما تماس می‌گیریم.',
      referSubmit: 'ثبت معرفی', referThanks: 'متشکریم!', referThanksDesc: 'معرفی شما ثبت شد. کد رهگیری را نگه دارید — پس از تأیید کارشناسان با شما تماس می‌گیریم.',
      referRelation: 'نسبت شما با ملک', relOwner: 'مالک هستم', relAcquaintance: 'مالک را می‌شناسم', relAgent: 'مشاور / واسطه', relOther: 'سایر',
      propertyTitle: 'عنوان ملک (اختیاری)', dealType: 'نوع معامله', propertyType: 'نوع ملک', district: 'منطقه / محله',
      areaSqm: 'متراژ (م²)', bedrooms: 'خواب', bathrooms: 'حمام', price: 'قیمت فروش (در صورت اطلاع)', addPhotos: 'افزودن عکس',
      uploading: 'در حال آپلود…', photoLimit: 'حداکثر ۸ عکس', referNotes: 'هر نکته دیگری که می‌دانید',
    },
    ar: {
      cartBtn: 'تأكيد الطلب', addProduct: 'أضف إلى السلة', addService: 'أضف إلى الطلب', added: 'تمت الإضافة ✓', all: 'الكل',
      searchPh: 'بحث في العقارات...', empty: 'لا توجد نتائج.', cartTitle: 'طلبك', cartEmpty: 'لا توجد عناصر بعد.',
      qty: 'الكمية', remove: 'حذف', total: 'الإجمالي', yourInfo: 'معلوماتك', name: 'الاسم الكامل', company: 'الشركة',
      phone: 'الجوال / واتساب', email: 'البريد الإلكتروني', country: 'الدولة', city: 'المدينة / الوجهة', notes: 'ملاحظات / طلبات خاصة',
      submit: 'إرسال الطلب', submitting: 'جارٍ الإرسال...', incomplete: 'يرجى إدخال الاسم ورقم الجوال.', err: 'فشل الإرسال. حاول مرة أخرى.',
      thanksTitle: 'تم استلام الطلب!', thanksDesc: 'تم استلام طلبك. احتفظ برمز التتبع أدناه — سنتواصل معك قريباً.',
      trackingCode: 'رمز تتبع الطلب', copy: 'نسخ', copied: 'تم النسخ', close: 'إغلاق', trackMy: 'متابعة طلباتي', trackBtn: 'عرض',
      trackCodePh: 'رمز التتبع', trackHint: 'ابحث برمز التتبع أو رقم الجوال — أضف اسمك لتضييق النتائج.', trackNeed: 'أدخل رمز التتبع أو رقم الجوال.',
      noOrders: 'لم يُعثر على طلبات. تحقق من رمز التتبع أو الجوال أو الاسم.', moq: 'الحد الأدنى', pack: 'عبوة', statusNew: 'جديد', statusProg: 'قيد التنفيذ', statusDone: 'مكتمل', statusCanc: 'ملغى',
      perPack: '/ عبوة', review: 'متابعة لمعاينة الفاتورة', invoiceTitle: 'معاينة الفاتورة', editCart: 'تعديل السلة',
      featured: 'مميز', featuredTitle: 'عقارات مميزة', negotiable: 'قابل للتفاوض — اطلب عرض سعر',
      outOfStock: 'غير متاح حالياً',
      colItem: 'البند', colQty: 'الكمية', colUnit: 'سعر الوحدة', colLine: 'المبلغ', invHint: 'هذه معاينة أولية؛ يُؤكد المبلغ النهائي بعد المراجعة.',
      confirm: 'تأكيد وإرسال الطلب', tabProducts: 'قائمة المنتجات', tabServices: 'الخدمات', subtotalLabel: 'مجموع البنود',
      feesLabel: 'رسوم إضافية', optionalFee: '(اختياري)', discountTitle: 'رمز الخصم', discountPh: 'أدخل رمز الخصم', apply: 'تطبيق',
      discountLine: 'خصم', taxIncl: 'شامل الضريبة', taxExcl: 'الضريبة', footPhone: 'الهاتف:', footEmail: 'البريد:', footWebsite: 'الموقع:',
      catalog: 'كتالوج PDF', downloadCatalog: 'تحميل كتالوج PDF',
      addProperty: 'طلب معاينة', tabRealEstate: 'العقارات', monthlyRent: 'الإيجار الشهري', deposit: 'التأمين',
      specs: 'مواصفات العقار', faqTitle: 'الأسئلة الشائعة', viewMap: 'عرض على الخريطة', virtualTour: 'جولة افتراضية', forSale: 'للبيع',
      inquiryBtn: 'طلب معاينة', inquiryTitle: 'طلب معاينة العقار', visitWhen: 'الوقت المفضل للمعاينة',
      inquirySubmit: 'إرسال طلب المعاينة', inquiryThanks: 'تم استلام طلبك!', trackInquiries: 'متابعة طلباتي',
      featuredProperties: 'عقارات مميزة', callAgent: 'اتصال', whatsappAgent: 'واتساب', footWhatsapp: 'واتساب:',
      priceDisplayOnly: 'السعر المعلن (للعرض فقط)',
      inquiryAsideHint: 'بعد التسجيل، سيتواصل معك مستشار العقارات.',
      inquiryFormHint: 'أدخل بيانات الاتصال لترتيب المعاينة.',
      namePh: 'الاسم الكامل', visitWhenPh: 'مثلاً السبت ١٠ صباحاً', notesPhExtra: 'أسئلة أو ملاحظات إضافية…',
      watchVideo: 'مشاهدة الفيديو', pcs: 'قطعة', offTag: ' خصم', cartEmptyErr: 'السلة فارغة.',
      invalidDiscount: 'رمز الخصم غير صالح.', minOrderDiscount: 'الحد الأدنى للطلب لهذا الرمز',
      discountNoApply: 'هذا الرمز لا ينطبق على عناصر سلتك.',
      referProperty: 'إحالة عقار', referTitle: 'أحِل عقاراً إلينا',
      referHint: 'تملك منزلاً أو تعرف من يريد البيع أو الإيجار؟ شارك ما تعرفه — سنتواصل معك بعد المراجعة.',
      referSubmit: 'إرسال الإحالة', referThanks: 'شكراً لك!', referThanksDesc: 'تم استلام إحالتك. احتفظ برمز التتبع — سنتواصل معك بعد المراجعة.',
      referRelation: 'علاقتك بالعقار', relOwner: 'أنا المالك', relAcquaintance: 'أعرف المالك', relAgent: 'وسيط / وكيل', relOther: 'أخرى',
      propertyTitle: 'عنوان العقار (اختياري)', dealType: 'نوع الصفقة', propertyType: 'نوع العقار', district: 'المنطقة / الحي',
      areaSqm: 'المساحة (م²)', bedrooms: 'غرف النوم', bathrooms: 'الحمامات', price: 'سعر البيع (إن وُجد)', addPhotos: 'إضافة صور',
      uploading: 'جارٍ الرفع…', photoLimit: 'حتى ٨ صور', referNotes: 'أي معلومات إضافية',
    },
    zh: {
      cartBtn: '下单', addProduct: '加入购物车', addService: '加入询价', added: '已添加 ✓', all: '全部',
      searchPh: '搜索商品...', empty: '未找到商品。', cartTitle: '您的订单', cartEmpty: '购物车为空。',
      qty: '数量', remove: '移除', total: '合计', yourInfo: '您的信息', name: '姓名', company: '公司',
      phone: '手机 / WhatsApp', email: '邮箱', country: '国家', city: '城市 / 目的地', notes: '备注 / 特殊要求',
      submit: '提交订单', submitting: '提交中...', incomplete: '请填写姓名和电话。', err: '提交失败，请重试。',
      thanksTitle: '订单已收到！', thanksDesc: '您的订单已收到。请保存下方的追踪码，我们会尽快与您联系。',
      trackingCode: '订单追踪码', copy: '复制', copied: '已复制', close: '关闭', trackMy: '查询我的订单', trackBtn: '查看',
      trackCodePh: '追踪码', trackHint: '可用追踪码或手机号查询 — 填写姓名可缩小范围。', trackNeed: '请输入追踪码或手机号。',
      noOrders: '未找到订单。请检查追踪码、手机号或姓名。', moq: '起订量', pack: '包装', statusNew: '新', statusProg: '处理中', statusDone: '已完成', statusCanc: '已取消',
      perPack: '/ 包', review: '继续并预览发票', invoiceTitle: '发票预览', editCart: '编辑购物车',
      featured: '精选', featuredTitle: '精选产品', negotiable: '价格面议 — 索取报价',
      outOfStock: '暂时缺货',
      colItem: '项目', colQty: '数量', colUnit: '单价', colLine: '金额', invHint: '这是形式发票预览；最终金额将在审核后确认。',
      confirm: '确认并提交订单', tabProducts: '产品列表', tabServices: '服务', subtotalLabel: '商品小计',
      feesLabel: '附加费用', optionalFee: '(可选)', discountTitle: '折扣码', discountPh: '输入折扣码', apply: '应用',
      discountLine: '折扣', taxIncl: '含税', taxExcl: '税', footPhone: '电话：', footEmail: '邮箱：', footWebsite: '网站：',
    },
  };
  const S = (k: string) => uiString(STRINGS, uiLang, k);
  const t: Record<string, string> = {};
  Object.keys(STRINGS.en).forEach(k => { t[k] = S(k); });
  t.add = isRealEstate ? S('inquiryBtn') : isServices ? S('addService') : S('addProduct');
  t.productsTab = isRealEstate
    ? (TR(shop.i18n, 'productsTabLabel', L(shop.productsTabLabel, shop.productsTabLabelEn)) || S('tabRealEstate'))
    : isServices ? S('tabServices') : S('tabProducts');
  if (isRealEstate) {
    t.featuredTitle = S('featuredProperties');
    t.trackMy = S('trackInquiries');
    if (shop.cartButtonText) t.inquiryBtn = TR(shop.i18n, 'cartButtonText', shop.cartButtonText);
  }
  if (shop.cartButtonText) {
    const cartTxt = TR(shop.i18n, 'cartButtonText', shop.cartButtonText);
    t.cartBtn = cartTxt; t.submit = cartTxt;
  }
  if (shop.searchPlaceholder) t.searchPh = TR(shop.i18n, 'searchPlaceholder', shop.searchPlaceholder);
  if (shop.orderThankYouText) t.thanksDesc = TR(shop.i18n, 'orderThankYouText', shop.orderThankYouText);

  // Content helpers (use per-product/shop i18n with legacy fallback)
  const pName = (p: MetaShopProduct) => TR(p.i18n, 'name', p.name);
  const pDesc = (p: MetaShopProduct) => TR(p.i18n, 'description', p.description || '');
  const pStock = (p: MetaShopProduct) => translateStockLabel(p.stockLabel, uiLang, p.i18n);
  const pGroup = (p: MetaShopProduct) => translateProductGroup(shop, p.group || '', uiLang, p.i18n);
  const pSubcategory = (p: MetaShopProduct) => translateProductSubcategory(p.subcategory || '', uiLang, p.i18n, products);
  const catLabel = (key: string) => categoryLabel(findCategoryEntry(shop.categories, key), uiLang, shop);

  const rePriceLabel = (p: MetaShopProduct): string | null => {
    const re = p.realEstate;
    if (!re) return null;
    const cur = re.rentCurrency || p.currency || shop.currency;
    const Lg = reLang();
    if (re.dealType === 'rent' || re.dealType === 'rent-short') {
      const parts: string[] = [];
      if (re.monthlyRent) parts.push(`${S('monthlyRent')}: ${formatMoney(re.monthlyRent, cur, Lg)}`);
      if (re.deposit) parts.push(`${S('deposit')}: ${formatMoney(re.deposit, cur, Lg)}`);
      return parts.join(' · ') || null;
    }
    if (p.price) return `${S('forSale')}: ${money(p.price, cur)}`;
    return null;
  };

  const theme = shop.theme;
  const money = (n?: number, cur?: string) => n == null ? '' : `${cur || shop.currency} ${(Math.round(n * 100) / 100).toLocaleString()}`;

  const products = useMemo(() => (shop.products || []).filter(p => p.active !== false), [shop.products]);
  // Deep link: ?shop=<slug>&product=<id> — indexable per-product URLs
  const readProductParam = () => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('product') || p.get('p');
    } catch { return null; }
  };
  const syncProductUrl = (productId: string | null) => {
    if (embed) return;
    try {
      const url = new URL(window.location.href);
      if (productId) url.searchParams.set('product', productId);
      else { url.searchParams.delete('product'); url.searchParams.delete('p'); }
      const qs = url.searchParams.toString();
      const next = qs ? `?${qs}` : window.location.pathname;
      if ((window.location.search || window.location.pathname) !== next) history.replaceState(null, '', next);
    } catch {}
  };
  useEffect(() => {
    const pid = readProductParam();
    if (!pid) return;
    const p = products.find(x => x.id === pid);
    if (p) { setDetail(p); setTab('products'); }
  }, [products]);
  useEffect(() => {
    const onPop = () => {
      const pid = readProductParam();
      if (!pid) { setDetail(null); return; }
      setDetail(products.find(x => x.id === pid) || null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [products]);
  // Up to 3 «ویژه» (featured) products, shown in a highlighted rail above the grid.
  const featuredProducts = useMemo(() => products.filter(p => p.featured).slice(0, 3), [products]);
  const categories = useMemo(
    () => normalizeShopCategories(shop.categories, products),
    [shop.categories, products],
  );

  // Subcategories available under the active category (derived from products)
  const subcategories = useMemo(() => {
    if (activeCat === 'all') return [];
    const set: string[] = [];
    products.forEach(p => { if (p.group === activeCat && p.subcategory && !set.includes(p.subcategory)) set.push(p.subcategory); });
    return set;
  }, [products, activeCat]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return products.filter(p => {
      const matchCat = activeCat === 'all' || p.group === activeCat;
      const matchSub = activeSub === 'all' || p.subcategory === activeSub;
      const matchSearch = !q || productMatchesSearch(shop, p, q);
      return (q ? matchSearch : matchCat && matchSub && matchSearch);
    });
  }, [products, activeCat, activeSub, search, shop]);

  const selectCat = (c: string) => { setActiveCat(c); setActiveSub('all'); };

  // ── Rate options (up to 3 named rates per product) ──
  const optionsOf = (p: MetaShopProduct) => p.priceOptions || [];
  // Effective currency for a product/option (option currency wins, then product, then shop)
  const curOf = (p: MetaShopProduct, optId?: string): string => {
    const o = optionsOf(p).find(x => x.id === optId);
    return (o?.currency && o.currency.trim()) || (p.currency && p.currency.trim()) || shop.currency;
  };
  const selOptId = (p: MetaShopProduct): string | undefined => {
    const opts = optionsOf(p); if (!opts.length) return undefined;
    return cart[p.id]?.optionId || chosenOpt[p.id] || opts[0].id;
  };
  // ── Per-product discount (percent or flat amount) ──
  const hasDiscount = (p: MetaShopProduct) => !!p.discountType && (p.discountValue ?? 0) > 0;
  // Apply the product discount to any base price (returns the rounded discounted price).
  const applyDisc = (p: MetaShopProduct, base?: number): number | undefined => {
    if (base == null || !hasDiscount(p)) return base;
    const v = p.discountValue!;
    const final = p.discountType === 'amount' ? base - v : base * (1 - v / 100);
    return Math.max(0, Math.round(final * 100) / 100);
  };
  // Effective % off for the badge (works for both discount types).
  const discPercent = (p: MetaShopProduct, base?: number): number => {
    if (!hasDiscount(p) || !base) return 0;
    if (p.discountType === 'percent') return Math.round(p.discountValue!);
    const final = applyDisc(p, base) ?? base;
    return Math.round((1 - final / base) * 100);
  };
  // Original (pre-discount) unit price.
  const baseUnitPrice = (p: MetaShopProduct, optId?: string): number => {
    const opts = optionsOf(p);
    if (opts.length) { const o = opts.find(x => x.id === optId) || opts[0]; return o?.price ?? 0; }
    return p.price ?? 0;
  };
  // Effective unit price (discount applied) — used for cart math and totals.
  const unitPrice = (p: MetaShopProduct, optId?: string): number => applyDisc(p, baseUnitPrice(p, optId)) ?? 0;
  // Price hidden → show «قابل مذاکره»; works per-product or shop-wide. Customer can still order a quantity.
  const priceHidden = (p: MetaShopProduct) => !!shop.hidePrices || !!p.hidePrice;
  // Label shown in place of the price: per-product override → shop-wide override → default «قابل مذاکره».
  const negLabel = (p?: MetaShopProduct) => (p && p.hidePriceText) || shop.hidePriceText || t.negotiable;
  const optLabel = (p: MetaShopProduct, optId?: string): string => { const o = optionsOf(p).find(x => x.id === optId); return o ? L(o.label, o.labelEn) : ''; };
  const selectOption = (p: MetaShopProduct, optId: string) => {
    setChosenOpt(ch => ({ ...ch, [p.id]: optId }));
    setCart(c => c[p.id] ? { ...c, [p.id]: { ...c[p.id], optionId: optId } } : c);
  };

  const cartItems = useMemo(() => Object.keys(cart).map(id => {
    const p = products.find(x => x.id === id); if (!p || p.outOfStock) return null;
    const { qty, optionId } = cart[id]; const hidden = priceHidden(p); const rate = hidden ? 0 : unitPrice(p, optionId);
    return { p, qty, optionId, rate, line: hidden ? 0 : rate * qty, hidden, optionText: optLabel(p, optionId), cur: curOf(p, optionId) };
  }).filter(Boolean) as { p: MetaShopProduct; qty: number; optionId?: string; rate: number; line: number; hidden: boolean; optionText: string; cur: string }[], [cart, products, uiLang]);

  const cartCount = Object.keys(cart).length;
  const grandTotal = cartItems.reduce((a, c) => a + c.line, 0); // items only (numeric sum; hidden-price items count as 0)
  const anyHidden = cartItems.some(c => c.hidden);
  const allHidden = cartItems.length > 0 && cartItems.every(c => c.hidden);
  // Per-currency subtotals (a cart may mix currencies, e.g. a money-exchange shop)
  const totalsByCurrency = useMemo(() => { const m: Record<string, number> = {}; cartItems.forEach(c => { m[c.cur] = (m[c.cur] || 0) + c.line; }); return m; }, [cartItems]);
  const currencyList = Object.keys(totalsByCurrency);
  const multiCur = currencyList.length > 1;
  const displayCur = currencyList[0] || shop.currency;
  const fmtTotals = (extra = 0) => currencyList.map((cur, i) => money(totalsByCurrency[cur] + (i === 0 ? extra : 0), cur)).join('  ·  ');
  const shopFees = shop.extraFees || [];
  const activeFees = shopFees.filter(f => f.required || selectedFees[f.id]);
  const feesTotal = activeFees.reduce((a, f) => a + (f.amount || 0), 0);
  const toggleFee = (id: string) => setSelectedFees(s => ({ ...s, [id]: !s[id] }));

  // ── Discount code ──
  const applicableSubtotal = (d: import('../types').MetaShopDiscount): number => {
    if (d.scope === 'products') return cartItems.filter(c => (d.productIds || []).includes(c.p.id)).reduce((a, c) => a + c.line, 0);
    if (d.scope === 'categories') return cartItems.filter(c => c.p.group && (d.categories || []).includes(c.p.group)).reduce((a, c) => a + c.line, 0);
    return grandTotal;
  };
  const computeDiscount = (d: import('../types').MetaShopDiscount | null): number => {
    if (!d) return 0;
    const base = applicableSubtotal(d);
    if (base <= 0) return 0;
    const raw = d.type === 'percent' ? base * (d.value || 0) / 100 : Math.min(d.value || 0, base);
    return Math.round(raw * 100) / 100;
  };
  const discountAmount = computeDiscount(appliedDiscount);
  // ── Tax (inclusive or exclusive) ──
  const taxRate = shop.taxRate || 0;
  const taxBase = Math.max(0, grandTotal - discountAmount) + feesTotal;
  const taxInclusive = !!shop.taxInclusive;
  const taxAmount = taxRate > 0 ? (taxInclusive ? taxBase - taxBase / (1 + taxRate / 100) : taxBase * taxRate / 100) : 0;
  const finalTotal = taxInclusive ? taxBase : taxBase + taxAmount;

  const applyDiscount = () => {
    const code = discountInput.trim();
    if (!code) return;
    const d = (shop.discounts || []).find(x => x.active !== false && x.code.trim().toLowerCase() === code.toLowerCase());
    if (!d) { setAppliedDiscount(null); setDiscountErr(S('invalidDiscount')); return; }
    if (d.minOrder && grandTotal < d.minOrder) { setAppliedDiscount(null); setDiscountErr(`${S('minOrderDiscount')} ${shop.currency} ${d.minOrder.toLocaleString()}`); return; }
    if (computeDiscount(d) <= 0) { setAppliedDiscount(null); setDiscountErr(S('discountNoApply')); return; }
    setAppliedDiscount(d); setDiscountErr('');
  };
  const removeDiscount = () => { setAppliedDiscount(null); setDiscountInput(''); setDiscountErr(''); };

  const openInquiry = (p: MetaShopProduct) => {
    if (p.outOfStock) return;
    setInquiryProp(p);
    setInquiryTracking(null);
    setInquiryForm({ customerName: '', phone: '', email: '', visitWhen: '', notes: '' });
    setError('');
    logMetaShopEvent('add_to_cart', { id: shop.id, name: shop.name }, { productId: p.id, productName: p.name, productGroup: p.group, via: embed ? 'gsite' : 'shop' });
  };

  const submitInquiry = async () => {
    if (!inquiryProp) return;
    if (!inquiryForm.customerName.trim() || !inquiryForm.phone.trim()) { setError(t.incomplete); return; }
    setSubmitting(true); setError('');
    try {
      const listed = rePriceLabel(inquiryProp);
      const noteParts = [
        inquiryForm.visitWhen && `${S('visitWhen')}: ${inquiryForm.visitWhen}`,
        listed && `${S('priceDisplayOnly')}: ${listed}`,
        inquiryForm.notes.trim(),
      ].filter(Boolean);
      const code = await onSubmitOrder({
        customerName: inquiryForm.customerName.trim(),
        phone: inquiryForm.phone.trim(),
        email: inquiryForm.email.trim() || undefined,
        notes: noteParts.join('\n') || undefined,
        items: [{ productId: inquiryProp.id, name: pName(inquiryProp), sku: inquiryProp.sku, qty: 1, priceHidden: true }],
        total: 0,
        currency: shop.currency,
      });
      setInquiryTracking(code);
    } catch { setError(t.err); }
    finally { setSubmitting(false); }
  };

  const openReferral = () => {
    setReferOpen(true);
    setReferTracking(null);
    setReferImages([]);
    setReferForm(emptyReferForm());
    setError('');
  };

  const uploadReferPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const remain = 8 - referImages.length;
    if (remain <= 0) return;
    const batch = Array.from(files).slice(0, remain);
    setReferUploading(true);
    let done = 0;
    const urls: string[] = [];
    const tick = () => {
      done++;
      if (done >= batch.length) {
        setReferImages(prev => [...prev, ...urls].slice(0, 8));
        setReferUploading(false);
      }
    };
    batch.forEach(f => uploadFileWithProgress(f, () => {}, u => { urls.push(u); tick(); }, () => tick(), 'images'));
  };

  const submitReferral = async () => {
    if (!onSubmitReferral) return;
    if (!referForm.referrerName.trim() || !referForm.referrerPhone.trim()) { setError(t.incomplete); return; }
    setSubmitting(true); setError('');
    try {
      const num = (s: string) => { const n = parseFloat(s.replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined; };
      const code = await onSubmitReferral({
        referrerName: referForm.referrerName.trim(),
        referrerPhone: referForm.referrerPhone.trim(),
        referrerEmail: referForm.referrerEmail.trim() || undefined,
        relation: referForm.relation,
        propertyTitle: referForm.propertyTitle.trim() || undefined,
        dealType: referForm.dealType,
        propertyType: referForm.propertyType,
        city: referForm.city.trim() || undefined,
        district: referForm.district.trim() || undefined,
        areaSqm: num(referForm.areaSqm),
        bedrooms: num(referForm.bedrooms) != null ? Math.round(num(referForm.bedrooms)!) : undefined,
        bathrooms: num(referForm.bathrooms) != null ? Math.round(num(referForm.bathrooms)!) : undefined,
        price: num(referForm.price),
        monthlyRent: num(referForm.monthlyRent),
        deposit: num(referForm.deposit),
        description: referForm.description.trim() || undefined,
        notes: referForm.notes.trim() || undefined,
        images: referImages,
      });
      setReferTracking(code);
    } catch { setError(t.err); }
    finally { setSubmitting(false); }
  };

  const addToCart = (p: MetaShopProduct) => {
    if (p.outOfStock) return; // out-of-stock products can't be ordered
    const optId = selOptId(p);
    setCart(c => ({ ...c, [p.id]: { qty: (c[p.id]?.qty || 0) + 1, optionId: optId } }));
    logMetaShopEvent('add_to_cart', { id: shop.id, name: shop.name }, { productId: p.id, productName: p.name, productGroup: p.group, via: embed ? 'gsite' : 'shop' });
  };
  // Open a product's detail modal and record the click for the shop's visit report.
  const closeDetail = () => { setDetail(null); syncProductUrl(null); };
  const openDetail = (p: MetaShopProduct) => {
    setDetail(p);
    syncProductUrl(p.id);
    logMetaShopEvent('product_click', { id: shop.id, name: shop.name }, { productId: p.id, productName: p.name, productGroup: p.group, via: embed ? 'gsite' : 'shop' });
  };
  const setQty = (id: string, q: number) => setCart(c => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = { ...n[id], qty: q }; return n; });

  const submit = async () => {
    if (!form.customerName.trim() || !form.phone.trim()) { setError(t.incomplete); return; }
    if (cartItems.length === 0) { setError(S('cartEmptyErr')); return; }
    setSubmitting(true); setError('');
    try {
      const code = await onSubmitOrder({
        customerName: form.customerName.trim(), company: form.company.trim() || undefined,
        phone: form.phone.trim(), email: form.email.trim() || undefined,
        country: form.country.trim() || undefined, city: form.city.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: cartItems.map(c => ({ productId: c.p.id, name: c.optionText ? `${pName(c.p)} — ${c.optionText}` : pName(c.p), sku: c.p.sku, unit: c.p.unit, qty: c.qty, unitPrice: c.hidden ? undefined : c.rate, lineTotal: c.hidden ? undefined : c.line, currency: c.cur, optionLabel: c.optionText || undefined, priceHidden: c.hidden || undefined })),
        fees: activeFees.map(f => ({ label: L(f.label, f.labelEn), amount: f.amount })),
        itemsTotal: grandTotal,
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        taxRate: taxRate > 0 ? taxRate : undefined,
        taxAmount: taxAmount > 0 ? Math.round(taxAmount * 100) / 100 : undefined,
        taxInclusive: taxRate > 0 ? taxInclusive : undefined,
        total: finalTotal, currency: shop.currency,
      });
      setTracking(code);
      setCart({}); setCartOpen(false);
    } catch { setError(t.err); }
    finally { setSubmitting(false); }
  };

  const doLookup = async () => {
    if (!onLookup) return;
    const code = lookupCode.trim(), phone = lookupPhone.trim(), name = lookupName.trim();
    setLookupErr('');
    // Need at least a tracking code or a phone number to look up an order.
    if (!code && !phone) { setLookupErr(t.trackNeed); setLookupResults(null); return; }
    setLookupBusy(true);
    try { setLookupResults(await onLookup({ trackingCode: code || undefined, phone: phone || undefined, name: name || undefined })); }
    finally { setLookupBusy(false); }
  };

  const statusLabel = (s: MetaShopOrder['status']) => s === 'done' ? t.statusDone : s === 'in_progress' ? t.statusProg : s === 'cancelled' ? t.statusCanc : t.statusNew;

  const cssVars = {
    ['--ms-primary' as any]: theme.primary, ['--ms-cover' as any]: theme.cover,
    ['--ms-cover-text' as any]: theme.coverText, ['--ms-bg' as any]: theme.bg,
    ['--ms-heading' as any]: theme.heading, ['--ms-text' as any]: theme.text,
  };

  // Real-estate: viewing request + contact — no cart / quantity
  const reContactActions = (p: MetaShopProduct, big = false) => {
    const c = resolvePropertyContact(shop, p, reLang());
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    return (
      <>
        {c.phone && (
          <a className="ms-re-contact" href={telHref(c.phone)} dir="ltr" title={c.phone}
            onClick={e => { stop(e); openTel(c.phone); }}>
            📞 {S('callAgent')}
          </a>
        )}
        {c.whatsapp && (
          <a className="ms-re-contact wa" href={waHref(c.whatsapp)} target="_blank" rel="noreferrer" dir="ltr" title={c.whatsapp}
            onClick={e => { stop(e); openWhatsApp(c.whatsapp); }}>
            💬 {S('whatsappAgent')}
          </a>
        )}
      </>
    );
  };

  const inquiryBlock = (p: MetaShopProduct, big = false) => {
    const listed = rePriceLabel(p);
    return (
      <div className="ms-buy ms-re-inquiry">
        {listed && (
          <div className="ms-price-row">
            <span className="ms-price-amt">{listed}</span>
            <span className="ms-price-unit" style={{ display: 'block', fontSize: 11, opacity: 0.75 }}>{S('priceDisplayOnly')}</span>
          </div>
        )}
        <div className={`ms-re-actions ${big ? 'big' : ''}`}>
          {p.outOfStock ? (
            <div className="ms-oos">{t.outOfStock}</div>
          ) : (
            <button type="button" className={`ms-add ${big ? 'lg' : ''}`} onClick={() => openInquiry(p)}>{t.inquiryBtn || S('inquiryBtn')}</button>
          )}
          {reContactActions(p, big)}
        </div>
      </div>
    );
  };

  // Price + rate options + quantity stepper / add button (products & services only)
  const buyBlock = (p: MetaShopProduct, big = false) => {
    if (isRealEstate) return inquiryBlock(p, big);
    const opts = optionsOf(p);
    const selId = selOptId(p);
    const qty = cart[p.id]?.qty || 0;
    const basePrice = baseUnitPrice(p, selId);
    const curPrice = unitPrice(p, selId);
    const cur = curOf(p, selId);
    const off = discPercent(p, basePrice);
    const basePack = p.packPrice;
    const hidden = priceHidden(p);
    return (
      <div className="ms-buy">
        {opts.length > 0 && (
          <div className="ms-opts">
            {opts.map(o => (
              <button key={o.id} className={`ms-opt ${selId === o.id ? 'on' : ''}`} onClick={() => selectOption(p, o.id)}>
                <span className="ms-opt-label">{L(o.label, o.labelEn)}</span>
                {!hidden && (
                  <span className="ms-opt-price">
                    {hasDiscount(p) && <span className="ms-opt-was">{money(o.price, curOf(p, o.id))}</span>}
                    {money(applyDisc(p, o.price), curOf(p, o.id))}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="ms-prices">
          {hidden ? (
            <div className="ms-price-row"><span className="ms-negotiable">{negLabel(p)}</span></div>
          ) : isRealEstate && rePriceLabel(p) ? (
            <div className="ms-price-row"><span className="ms-price-amt">{rePriceLabel(p)}</span></div>
          ) : (<>
          {(curPrice != null) && (
            <div className="ms-price-row">
              {hasDiscount(p) && <span className="ms-price-was">{money(basePrice, cur)}</span>}
              <span className="ms-price-amt">{money(curPrice, cur)} {p.unit && <span className="ms-price-unit">/{p.unit}</span>} {isServices && p.priceUnit && <span className="ms-price-unit">{p.priceUnit}</span>}</span>
              {off > 0 && <span className="ms-disc-tag">{off}%{S('offTag')}</span>}
            </div>
          )}
          {!isServices && !isRealEstate && opts.length === 0 && basePack != null && basePack > 0 && (
            <div className="ms-price-row">
              {hasDiscount(p) && <span className="ms-price-was">{money(basePack, curOf(p))}</span>}
              <span className="ms-price-amt ms-pack">{money(applyDisc(p, basePack), curOf(p))} <span className="ms-price-unit">{t.perPack}</span></span>
            </div>
          )}
          </>)}
        </div>
        {p.outOfStock ? (
          <div className="ms-oos">{t.outOfStock}</div>
        ) : qty > 0 ? (
          <>
            <div className={`ms-card-qty ${big ? 'big' : ''}`}>
              <button onClick={() => setQty(p.id, qty - 1)}>−</button>
              <input className="ms-card-qinp" value={qty} inputMode="numeric" onChange={e => setQty(p.id, parseInt(e.target.value.replace(/[^\d]/g, '')) || 0)} onFocus={e => e.target.select()} />
              <button onClick={() => setQty(p.id, qty + 1)}>+</button>
              <button className="ms-card-rm" onClick={() => setQty(p.id, 0)} title={t.remove}>✕</button>
            </div>
            {!hidden && curPrice != null && curPrice > 0 && (
              <div className="ms-card-calc">{qty.toLocaleString()} {p.unit ? p.unit : S('pcs')} × {money(curPrice, cur)} = <b>{money(curPrice * qty, cur)}</b></div>
            )}
            {hidden && (
              <div className="ms-card-calc">{qty.toLocaleString()} {p.unit ? p.unit : S('pcs')} · <b>{negLabel(p)}</b></div>
            )}
          </>
        ) : (
          <button className={`ms-add ${big ? 'lg' : ''}`} onClick={() => addToCart(p)}>{t.add}</button>
        )}
      </div>
    );
  };

  // Single product card — reused by the featured rail and the main grid.
  const productCard = (p: MetaShopProduct, opts: { featured?: boolean } = {}) => {
    const off = discPercent(p, baseUnitPrice(p, selOptId(p)));
    const re = p.realEstate;
    const reSummary = isRealEstate ? realEstateCardSummary(p, reLang()) : [];
    const stock = pStock(p);
    return (
      <article className={`ms-card ${opts.featured ? 'ms-card-feat' : ''} ${p.outOfStock ? 'ms-card-oos' : ''}`} key={p.id}>
        <div className="ms-card-img" onClick={() => openDetail(p)}>
          {p.images && p.images[0] ? <img src={p.images[0]} alt={pName(p)} loading="lazy" /> : <div className="ms-noimg">{pName(p).charAt(0)}</div>}
          {p.outOfStock && <span className="ms-oos-badge">{t.outOfStock}</span>}
          {re && <span className="ms-group-badge" style={{ background: 'var(--ms-primary)' }}>{dealTypeLabel(re.dealType, reLang())}</span>}
          {!re && p.group && <span className="ms-group-badge">{pGroup(p)}</span>}
          {off > 0 && <span className="ms-disc-ribbon">−{off}%</span>}
          {opts.featured && <span className="ms-feat-badge">★ {t.featured}</span>}
          <div className="ms-media-badges">
            {p.images && p.images.length > 1 && <span className="ms-media-badge">🖼 {p.images.length}</span>}
            {p.videoUrl && <span className="ms-media-badge">▶</span>}
          </div>
        </div>
        <div className="ms-card-body">
          <h3 className="ms-pname" onClick={() => openDetail(p)}>{pName(p)}</h3>
          <div className="ms-badges">
            {p.sku && <span className="ms-sku">{p.sku}</span>}
            {re && <span className="ms-subcat-badge">{propertyTypeLabel(re.propertyType, reLang())}</span>}
            {p.subcategory && <span className="ms-subcat-badge">{pSubcategory(p)}</span>}
            {stock && <span className="ms-stock">{stock}</span>}
          </div>
          {pDesc(p) && <p className="ms-desc">{pDesc(p)}</p>}
          {reSummary.length > 0 && (
            <div className="ms-meta">{reSummary.map((line, i) => <span key={i}>{line}</span>)}</div>
          )}
          {!isServices && !isRealEstate && (p.pack || p.moq) && (
            <div className="ms-meta">
              {p.pack != null && <span>{t.pack}: <b>{p.pack} {p.unit}</b></span>}
              {p.moq && <span>{t.moq}: <b>{p.moq}</b></span>}
            </div>
          )}
          {isRealEstate ? inquiryBlock(p) : buyBlock(p)}
        </div>
      </article>
    );
  };

  const footText = TR(shop.i18n, 'footerText', shop.footerText || '');
  const footAddress = TR(shop.i18n, 'address', shop.address || '');

  // Printable A4 PDF catalog of this shop — same link with ?catalog=1 (+ current language). Opens in a new tab.
  const catalogHref = `${window.location.origin}${window.location.pathname}?shop=${encodeURIComponent(shop.slug)}&catalog=1&lang=${uiLang}`;

  return (
    <div className={`ms-root ${embed ? 'ms-embed' : ''}`} dir={dir} style={cssVars}>
      <style>{MS_CSS}</style>

      {/* Topbar */}
      <nav className="ms-topbar">
        <div className="ms-topbar-inner">
          <div className="ms-brand">
            {shop.logo && <img src={shop.logo} alt="" className="ms-logo" />}
            <span className="ms-name">{shop.name}</span>
            <span className="ms-code" dir="ltr">{shopCodeOf(shop)}</span>
          </div>
          <div className="ms-top-actions">
            {langs.length > 1 && (
              <div className="ms-lang">
                {langs.map(lg => <button key={lg.code} className={uiLang === lg.code ? 'on' : ''} onClick={() => setUiLang(lg.code)}>{lg.name}</button>)}
              </div>
            )}
            <a className="ms-cat-btn" href={catalogHref} target="_blank" rel="noreferrer" title={t.downloadCatalog}>
              <PdfIcon s={16} /><span className="ms-cat-lbl">{t.catalog}</span>
            </a>
            {!isRealEstate && (
            <button className={`ms-cart-btn ${cartCount ? 'has' : ''}`} onClick={() => (setStep('cart'), setCartOpen(true))}>
              <CartIcon s={16} /><span>{t.cartBtn}</span>{cartCount > 0 && <span className="ms-badge">{cartCount}</span>}
            </button>
            )}
          </div>
        </div>
      </nav>

      {/* Cover */}
      <header className="ms-cover" style={shop.coverImage ? { backgroundImage: `linear-gradient(160deg, rgba(0,0,0,.33), rgba(0,0,0,.5)), url(${shop.coverImage})` } : undefined}>
        <div className="ms-cover-inner">
          {(TR(shop.i18n, 'collectionText', shop.collectionText || '')) && <p className="ms-collection">{TR(shop.i18n, 'collectionText', shop.collectionText || '')}</p>}
          <h1>{TR(shop.i18n, 'title', shop.title || shop.name)}</h1>
          {(TR(shop.i18n, 'subtitle', shop.subtitle || '')) && <p className="ms-subtitle">{TR(shop.i18n, 'subtitle', shop.subtitle || '')}</p>}
        </div>
      </header>

      <main className="ms-container">
        {/* Tabs (Product List + custom pages) */}
        {pages.length > 0 && (
          <nav className="ms-tabs">
            <button className={`ms-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>{L(shop.productsTabLabel, shop.productsTabLabelEn) || t.productsTab}</button>
            {pages.map(pg => <button key={pg.id} className={`ms-tab ${tab === pg.id ? 'active' : ''}`} onClick={() => setTab(pg.id)}>{TR(pg.i18n, 'label', L(pg.label, pg.labelEn))}</button>)}
          </nav>
        )}

        {tab === 'products' && (<>
        {/* Search */}
        <div className="ms-tools">
          <div className="ms-search">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPh} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </div>
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <ScrollPillRow barClassName="ms-filter-bar" activeId={activeCat}>
            <button type="button" data-pill-id="all" className={`ms-pill ${activeCat === 'all' ? 'active' : ''}`} onClick={() => selectCat('all')}>{t.all}</button>
            {categories.map(c => (
              <button type="button" key={c} data-pill-id={c} className={`ms-pill ${activeCat === c ? 'active' : ''}`} onClick={() => selectCat(c)}>{catLabel(c)}</button>
            ))}
          </ScrollPillRow>
        )}

        {/* Subcategory pills (under the active category) */}
        {subcategories.length > 0 && (
          <ScrollPillRow barClassName="ms-subfilter-bar" activeId={activeSub}>
            <button type="button" data-pill-id="all" className={`ms-subpill ${activeSub === 'all' ? 'active' : ''}`} onClick={() => setActiveSub('all')}>{t.all}</button>
            {subcategories.map(s => {
              const sample = products.find(p => p.group === activeCat && p.subcategory === s);
              const label = sample ? pSubcategory(sample) : translateProductSubcategory(s, uiLang, undefined, products);
              return (
                <button type="button" key={s} data-pill-id={s} className={`ms-subpill ${activeSub === s ? 'active' : ''}`} onClick={() => setActiveSub(s)}>{label}</button>
              );
            })}
          </ScrollPillRow>
        )}

        {/* Featured rail (up to 3) — only on the default «all» view without an active search */}
        {featuredProducts.length > 0 && activeCat === 'all' && !search.trim() && (
          <div className="ms-featured">
            <div className="ms-featured-head"><span className="ms-featured-star">★</span> {t.featuredTitle}</div>
            <div className="ms-featured-grid">
              {featuredProducts.map(p => productCard(p, { featured: true }))}
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? <p className="ms-empty">{t.empty}</p> : (
          <div className="ms-grid">
            {filtered.map(p => productCard(p))}
          </div>
        )}

        {onLookup && (
          <div className="ms-track-link">
            <button onClick={() => setLookupOpen(v => !v)}>{t.trackMy}</button>
            {lookupOpen && (
              <div className="ms-track-box">
                <p className="ms-track-hint">{t.trackHint}</p>
                <div className="ms-track-fields">
                  <input value={lookupCode} onChange={e => setLookupCode(e.target.value)} placeholder={t.trackCodePh} dir="ltr" onKeyDown={e => { if (e.key === 'Enter') doLookup(); }} />
                  <input value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} placeholder={t.phone} dir="ltr" onKeyDown={e => { if (e.key === 'Enter') doLookup(); }} />
                  <input value={lookupName} onChange={e => setLookupName(e.target.value)} placeholder={t.name} onKeyDown={e => { if (e.key === 'Enter') doLookup(); }} />
                  <button onClick={doLookup} disabled={lookupBusy}>{lookupBusy ? t.submitting : t.trackBtn}</button>
                </div>
                {lookupErr && <p className="ms-track-empty">{lookupErr}</p>}
                {lookupResults && (lookupResults.length === 0
                  ? <p className="ms-track-empty">{t.noOrders}</p>
                  : <div className="ms-track-list">{lookupResults.map(o => (
                      <div key={o.id} className="ms-track-item">
                        <div><b>{o.trackingCode}</b> · {o.shopName}</div>
                        <div className="ms-track-sub">{new Date(o.createdAt).toLocaleString(locale)} · {money(o.total)} · <span className="ms-status">{statusLabel(o.status)}</span></div>
                      </div>))}
                    </div>)}
              </div>
            )}
          </div>
        )}
        </>)}

        {/* Custom content pages */}
        {pages.map(pg => tab === pg.id ? <PageView key={pg.id} page={pg} uiLang={uiLang} L={L} /> : null)}
      </main>

      <footer className="ms-footer">
        <div className="ms-foot-grid">
          {shop.phone && <div><b>{t.footPhone}</b> <a href={telHref(shop.phone)} dir="ltr" onClick={e => { e.preventDefault(); openTel(shop.phone); }}>{shop.phone}</a></div>}
          {shop.whatsapp && <div><b>{S('footWhatsapp')}</b> <a href={waHref(shop.whatsapp)} dir="ltr" target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); openWhatsApp(shop.whatsapp); }}>{shop.whatsapp}</a></div>}
          {shop.email && <div><b>{t.footEmail}</b> <a href={`mailto:${shop.email}`}>{shop.email}</a></div>}
          {shop.website && <div><b>{t.footWebsite}</b> <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noreferrer" dir="ltr">{shop.website}</a></div>}
          {footAddress && <div>{footAddress}</div>}
        </div>
        <div className="ms-foot-actions">
          <a className="ms-foot-catalog" href={catalogHref} target="_blank" rel="noreferrer">
            <PdfIcon s={17} /><span>{t.downloadCatalog}</span>
          </a>
          {isRealEstate && onSubmitReferral && (
            <button type="button" className="ms-foot-refer" onClick={openReferral}>
              <span>🏠</span><span>{S('referProperty')}</span>
            </button>
          )}
        </div>
        {footText && <p className="ms-foot-text">{footText}</p>}
      </footer>

      {/* Product detail modal */}
      {detail && (
        <div className="ms-modal-ov" onClick={closeDetail}>
          <div className="ms-modal" onClick={e => e.stopPropagation()}>
            <button className="ms-modal-x" onClick={closeDetail}>✕</button>
            <div className="ms-modal-gal">
              {(() => {
                const imgs = detail.images || [];
                const main = imgs[galIdx] || imgs[0];
                return (
                  <>
                    <div className="ms-gal-main">
                      {main ? <img src={main} alt={pName(detail)} decoding="async" /> : <div className="ms-noimg lg">{pName(detail).charAt(0)}</div>}
                      {imgs.length > 1 && <>
                        <button className="ms-gal-nav prev" onClick={() => setGalIdx((galIdx - 1 + imgs.length) % imgs.length)}>‹</button>
                        <button className="ms-gal-nav next" onClick={() => setGalIdx((galIdx + 1) % imgs.length)}>›</button>
                      </>}
                    </div>
                    {imgs.length > 1 && (
                      <div className="ms-thumbs">{imgs.map((s, i) => <button key={i} className={`ms-thumb ${i === galIdx ? 'on' : ''}`} onClick={() => setGalIdx(i)}><img src={s} alt="" loading="lazy" decoding="async" /></button>)}</div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="ms-modal-info">
              <h2>{pName(detail)}</h2>
              <div className="ms-badges">{detail.sku && <span className="ms-sku">{detail.sku}</span>}{detail.hsCode && <span className="ms-hs">HS: {detail.hsCode}</span>}{pStock(detail) && <span className="ms-stock">{pStock(detail)}</span>}</div>
              {pDesc(detail) && <p className="ms-modal-desc">{pDesc(detail)}</p>}
              {(() => {
                const v = videoEmbed(detail.videoUrl);
                if (!v) return null;
                if (v.type === 'iframe') return <div className="ms-video"><iframe src={v.src} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="video" /></div>;
                if (v.type === 'video') return <div className="ms-video"><video src={v.src} controls /></div>;
                return <a className="ms-video-link" href={v.src} target="_blank" rel="noreferrer">▶ {S('watchVideo')}</a>;
              })()}
              {detail.colors && detail.colors.length > 0 && (
                <div className="ms-colors">{detail.colors.map((c, i) => <span key={i} className="ms-color-chip"><i style={{ background: c.hex2 ? `linear-gradient(135deg, ${c.hex}, ${c.hex2})` : c.hex }} />{c.name}</span>)}</div>
              )}
              {detail.features && detail.features.length > 0 && (
                <div className="ms-feats">{detail.features.map((f, i) => <div key={i}><span>{f.label}</span><b>{f.value}</b></div>)}</div>
              )}
              {!isServices && !isRealEstate && (detail.pack || detail.moq) && (
                <div className="ms-meta">{detail.pack != null && <span>{t.pack}: <b>{detail.pack} {detail.unit}</b></span>}{detail.moq && <span>{t.moq}: <b>{detail.moq}</b></span>}</div>
              )}
              {isRealEstate && detail.realEstate && (() => {
                const rows = realEstateDetailRows(detail, reLang());
                const re = detail.realEstate;
                const faq = realEstateFaqs(re, reLang(), detail.i18n);
                const contact = resolvePropertyContact(shop, detail, reLang());
                return (
                  <div className="ms-realestate-detail">
                    {rePriceLabel(detail) && !priceHidden(detail) && (
                      <div className="ms-price-row" style={{ marginBottom: 12 }}><span className="ms-price-amt">{rePriceLabel(detail)}</span></div>
                    )}
                    {rows.length > 0 && (
                      <div className="ms-feats ms-re-specs">
                        <div className="ms-re-specs-title">{S('specs')}</div>
                        {rows.map((r, i) => <div key={i}><span>{r.label}</span><b>{r.value}</b></div>)}
                      </div>
                    )}
                    {re.mapUrl && <a className="ms-video-link" href={re.mapUrl} target="_blank" rel="noreferrer">📍 {S('viewMap')}</a>}
                    {re.virtualTourUrl && <a className="ms-video-link" href={re.virtualTourUrl} target="_blank" rel="noreferrer" style={{ marginInlineStart: 12 }}>🎥 {S('virtualTour')}</a>}
                    {(contact.agentName || contact.phone || contact.whatsapp) && (
                      <div className="ms-re-agent-block">
                        {contact.agentName && <span className="ms-re-agent-name">{contact.agentName}</span>}
                        <div className="ms-re-actions">
                          {reContactActions(detail)}
                        </div>
                      </div>
                    )}
                    {faq.length > 0 && (
                      <div className="ms-re-faq">
                        <div className="ms-re-specs-title">{S('faqTitle')}</div>
                        {faq.map((f, i) => (
                          <details key={i} className="ms-re-faq-item">
                            <summary>{realEstateFaqText(f, 'q', reLang())}</summary>
                            <p>{realEstateFaqText(f, 'a', reLang())}</p>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              {buyBlock(detail, true)}
            </div>
          </div>
        </div>
      )}

      {/* Real-estate inquiry modal (no cart) */}
      {inquiryProp && (() => {
        const inqSummary = realEstateCardSummary(inquiryProp, reLang());
        const inqListed = rePriceLabel(inquiryProp);
        const inqDeal = inquiryProp.realEstate?.dealType
          ? dealTypeLabel(inquiryProp.realEstate.dealType, reLang())
          : '';
        const inqImg = inquiryProp.images?.[0];
        return (
          <div className="ms-modal-ov" onClick={() => !submitting && setInquiryProp(null)}>
            <div className="ms-inquiry-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ms-inq-title">
              <button type="button" className="ms-inq-close" onClick={() => setInquiryProp(null)} disabled={submitting} aria-label={t.close}>✕</button>
              {inquiryTracking ? (
                <div className="ms-inq-success">
                  <div className="ms-inq-success-ic">✓</div>
                  <h2>{S('inquiryThanks')}</h2>
                  <p>{shop.orderThankYouText || t.thanksDesc}</p>
                  <div className="ms-track-code">
                    <span className="ms-track-label">{t.trackingCode}</span>
                    <div className="ms-track-val"><b dir="ltr">{inquiryTracking}</b>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(inquiryTracking); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? t.copied : t.copy}</button>
                    </div>
                  </div>
                  <button type="button" className="ms-inq-submit" onClick={() => setInquiryProp(null)}>{t.close}</button>
                </div>
              ) : (
                <div className="ms-inq-layout">
                  <aside className="ms-inq-aside">
                    {inqImg ? (
                      <div className="ms-inq-img-wrap"><img src={inqImg} alt="" /></div>
                    ) : (
                      <div className="ms-inq-img-wrap ms-inq-img-ph">{pName(inquiryProp).charAt(0)}</div>
                    )}
                    <div className="ms-inq-aside-body">
                      {inqDeal && <span className="ms-inq-badge">{inqDeal}</span>}
                      <h3 className="ms-inq-prop-name">{pName(inquiryProp)}</h3>
                      {inqSummary.length > 0 && (
                        <ul className="ms-inq-chips">
                          {inqSummary.map((line, i) => <li key={i}>{line}</li>)}
                        </ul>
                      )}
                      {inqListed && <p className="ms-inq-price">{inqListed}</p>}
                      {inquiryProp.sku && <p className="ms-inq-sku" dir="ltr">{inquiryProp.sku}</p>}
                      <p className="ms-inq-aside-hint">{S('inquiryAsideHint')}</p>
                    </div>
                  </aside>
                  <div className="ms-inq-main">
                    <header className="ms-inq-head">
                      <h2 id="ms-inq-title">{S('inquiryTitle')}</h2>
                      <p>{S('inquiryFormHint')}</p>
                    </header>
                    <div className="ms-inq-form-wrap">
                      <div className="ms-inq-form">
                        <label className="ms-inq-field">
                          <span>{t.name} <em>*</em></span>
                          <input value={inquiryForm.customerName} onChange={e => setInquiryForm(f => ({ ...f, customerName: e.target.value }))} placeholder={S('namePh')} autoComplete="name" />
                        </label>
                        <label className="ms-inq-field">
                          <span>{t.phone} <em>*</em></span>
                          <input value={inquiryForm.phone} onChange={e => setInquiryForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" placeholder="+968 …" autoComplete="tel" />
                        </label>
                        <label className="ms-inq-field">
                          <span>{t.email}</span>
                          <input type="email" value={inquiryForm.email} onChange={e => setInquiryForm(f => ({ ...f, email: e.target.value }))} dir="ltr" placeholder="email@example.com" autoComplete="email" />
                        </label>
                        <label className="ms-inq-field">
                          <span>{S('visitWhen')}</span>
                          <input value={inquiryForm.visitWhen} onChange={e => setInquiryForm(f => ({ ...f, visitWhen: e.target.value }))} placeholder={S('visitWhenPh')} />
                        </label>
                        <label className="ms-inq-field ms-inq-field-full">
                          <span>{t.notes}</span>
                          <textarea rows={3} value={inquiryForm.notes} onChange={e => setInquiryForm(f => ({ ...f, notes: e.target.value }))} placeholder={S('notesPhExtra')} />
                        </label>
                      </div>
                    </div>
                    <footer className="ms-inq-foot">
                      {error && <p className="ms-err">{error}</p>}
                      <button type="button" className="ms-inq-submit" onClick={submitInquiry} disabled={submitting}>
                        {submitting ? t.submitting : (S('inquirySubmit') || t.inquiryBtn)}
                      </button>
                    </footer>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Property referral modal — real estate only */}
      {referOpen && onSubmitReferral && (
        <div className="ms-modal-ov" onClick={() => !submitting && !referUploading && setReferOpen(false)}>
          <div className="ms-refer-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className="ms-inq-close" onClick={() => setReferOpen(false)} disabled={submitting || referUploading} aria-label={t.close}>✕</button>
            {referTracking ? (
              <div className="ms-inq-success">
                <div className="ms-inq-success-ic">✓</div>
                <h2>{S('referThanks')}</h2>
                <p>{S('referThanksDesc')}</p>
                <div className="ms-track-code">
                  <span className="ms-track-label">{t.trackingCode}</span>
                  <div className="ms-track-val"><b dir="ltr">{referTracking}</b>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(referTracking); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? t.copied : t.copy}</button>
                  </div>
                </div>
                <button type="button" className="ms-inq-submit" onClick={() => setReferOpen(false)}>{t.close}</button>
              </div>
            ) : (
              <div className="ms-refer-body">
                <header className="ms-inq-head">
                  <h2>{S('referTitle')}</h2>
                  <p>{S('referHint')}</p>
                </header>
                <div className="ms-refer-form">
                  <div className="ms-refer-section">
                    <h4>{t.yourInfo}</h4>
                    <div className="ms-refer-grid">
                      <label className="ms-inq-field"><span>{t.name} <em>*</em></span><input value={referForm.referrerName} onChange={e => setReferForm(f => ({ ...f, referrerName: e.target.value }))} autoComplete="name" /></label>
                      <label className="ms-inq-field"><span>{t.phone} <em>*</em></span><input value={referForm.referrerPhone} onChange={e => setReferForm(f => ({ ...f, referrerPhone: e.target.value }))} dir="ltr" autoComplete="tel" /></label>
                      <label className="ms-inq-field"><span>{t.email}</span><input type="email" value={referForm.referrerEmail} onChange={e => setReferForm(f => ({ ...f, referrerEmail: e.target.value }))} dir="ltr" /></label>
                      <label className="ms-inq-field"><span>{S('referRelation')}</span>
                        <select value={referForm.relation} onChange={e => setReferForm(f => ({ ...f, relation: e.target.value }))}>
                          <option value="owner">{S('relOwner')}</option>
                          <option value="acquaintance">{S('relAcquaintance')}</option>
                          <option value="agent">{S('relAgent')}</option>
                          <option value="other">{S('relOther')}</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="ms-refer-section">
                    <h4>{S('tabRealEstate')}</h4>
                    <div className="ms-refer-grid">
                      <label className="ms-inq-field ms-inq-field-full"><span>{S('propertyTitle')}</span><input value={referForm.propertyTitle} onChange={e => setReferForm(f => ({ ...f, propertyTitle: e.target.value }))} /></label>
                      <label className="ms-inq-field"><span>{S('dealType')}</span>
                        <select value={referForm.dealType} onChange={e => setReferForm(f => ({ ...f, dealType: e.target.value }))}>
                          {Object.keys(DEAL_TYPE_LABEL).map(k => <option key={k} value={k}>{dealTypeLabel(k, uiLang)}</option>)}
                        </select>
                      </label>
                      <label className="ms-inq-field"><span>{S('propertyType')}</span>
                        <select value={referForm.propertyType} onChange={e => setReferForm(f => ({ ...f, propertyType: e.target.value }))}>
                          {Object.keys(PROPERTY_TYPE_LABEL).map(k => <option key={k} value={k}>{propertyTypeLabel(k, uiLang)}</option>)}
                        </select>
                      </label>
                      <label className="ms-inq-field"><span>{t.city}</span><input value={referForm.city} onChange={e => setReferForm(f => ({ ...f, city: e.target.value }))} /></label>
                      <label className="ms-inq-field"><span>{S('district')}</span><input value={referForm.district} onChange={e => setReferForm(f => ({ ...f, district: e.target.value }))} /></label>
                      <label className="ms-inq-field"><span>{S('areaSqm')}</span><input inputMode="decimal" value={referForm.areaSqm} onChange={e => setReferForm(f => ({ ...f, areaSqm: e.target.value }))} dir="ltr" /></label>
                      <label className="ms-inq-field"><span>{S('bedrooms')}</span><input inputMode="numeric" value={referForm.bedrooms} onChange={e => setReferForm(f => ({ ...f, bedrooms: e.target.value }))} dir="ltr" /></label>
                      <label className="ms-inq-field"><span>{S('bathrooms')}</span><input inputMode="numeric" value={referForm.bathrooms} onChange={e => setReferForm(f => ({ ...f, bathrooms: e.target.value }))} dir="ltr" /></label>
                      {(referForm.dealType === 'rent' || referForm.dealType === 'rent-short') ? (<>
                        <label className="ms-inq-field"><span>{S('monthlyRent')}</span><input inputMode="decimal" value={referForm.monthlyRent} onChange={e => setReferForm(f => ({ ...f, monthlyRent: e.target.value }))} dir="ltr" /></label>
                        <label className="ms-inq-field"><span>{S('deposit')}</span><input inputMode="decimal" value={referForm.deposit} onChange={e => setReferForm(f => ({ ...f, deposit: e.target.value }))} dir="ltr" /></label>
                      </>) : (
                        <label className="ms-inq-field"><span>{S('price')}</span><input inputMode="decimal" value={referForm.price} onChange={e => setReferForm(f => ({ ...f, price: e.target.value }))} dir="ltr" /></label>
                      )}
                      <label className="ms-inq-field ms-inq-field-full"><span>{t.notes}</span><textarea rows={2} value={referForm.description} onChange={e => setReferForm(f => ({ ...f, description: e.target.value }))} /></label>
                      <label className="ms-inq-field ms-inq-field-full"><span>{S('referNotes')}</span><textarea rows={2} value={referForm.notes} onChange={e => setReferForm(f => ({ ...f, notes: e.target.value }))} /></label>
                    </div>
                  </div>
                  <div className="ms-refer-section">
                    <h4>{S('addPhotos')} <span className="ms-refer-ph-limit">({S('photoLimit')})</span></h4>
                    <div className="ms-refer-photos">
                      {referImages.map((url, i) => (
                        <div key={i} className="ms-refer-ph"><img src={url} alt="" /><button type="button" onClick={() => setReferImages(im => im.filter((_, j) => j !== i))}>✕</button></div>
                      ))}
                      {referImages.length < 8 && (
                        <button type="button" className="ms-refer-ph-add" onClick={() => referFileRef.current?.click()} disabled={referUploading}>
                          {referUploading ? S('uploading') : '+'}
                        </button>
                      )}
                    </div>
                    <input type="file" ref={referFileRef} className="hidden" accept="image/*" multiple onChange={e => { uploadReferPhotos(e.target.files); e.target.value = ''; }} />
                  </div>
                </div>
                <footer className="ms-inq-foot">
                  {error && <p className="ms-err">{error}</p>}
                  <button type="button" className="ms-inq-submit" onClick={submitReferral} disabled={submitting || referUploading}>
                    {submitting ? t.submitting : S('referSubmit')}
                  </button>
                </footer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cart drawer — products & services only */}
      {!isRealEstate && (
      <>
      <div className={`ms-cart-ov ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`ms-drawer ${cartOpen ? 'open' : ''}`}>
        <header className="ms-drawer-head"><h2>{step === 'review' ? t.invoiceTitle : t.cartTitle}</h2><button onClick={() => setCartOpen(false)}>✕</button></header>

        {/* STEP 1 — cart items */}
        {step === 'cart' && (
          <>
            <div className="ms-drawer-body">
              {cartItems.length === 0 ? <p className="ms-cart-empty">{t.cartEmpty}</p> : cartItems.map(({ p, qty, line, hidden, optionText, cur }) => {
                const showPrice = optionsOf(p).length > 0 || p.price != null;
                return (
                <div className="ms-citem" key={p.id}>
                  {p.images && p.images[0] ? <img src={p.images[0]} alt="" /> : <div className="ms-noimg sm">{p.name.charAt(0)}</div>}
                  <div className="ms-citem-info">
                    <div className="ms-citem-name">{pName(p)}</div>
                    {optionText && <div className="ms-citem-opt">{optionText}</div>}
                    {p.sku && <div className="ms-citem-sku">{p.sku}</div>}
                    <div className="ms-citem-row">
                      <div className="ms-qty"><button onClick={() => setQty(p.id, qty - 1)}>−</button><input value={qty} onChange={e => setQty(p.id, parseInt(e.target.value) || 0)} /><button onClick={() => setQty(p.id, qty + 1)}>+</button></div>
                      <button className="ms-rm" onClick={() => setQty(p.id, 0)}>{t.remove}</button>
                    </div>
                    {hidden ? <div className="ms-citem-price ms-citem-neg">{negLabel(p)}</div> : (showPrice && <div className="ms-citem-price">{money(line, cur)}</div>)}
                  </div>
                </div>
                );
              })}
            </div>
            {cartItems.length > 0 && (
              <div className="ms-checkout-bar">
                <div className="ms-summary"><span>{t.total}</span><b>{allHidden ? negLabel() : (multiCur ? fmtTotals() : money(grandTotal, displayCur))}{!allHidden && anyHidden && <span className="ms-some-neg"> + {negLabel()}</span>}</b></div>
                <button className="ms-submit" onClick={() => { setError(''); setStep('review'); }}>{t.review} →</button>
              </div>
            )}
          </>
        )}

        {/* STEP 2 — invoice preview + customer info */}
        {step === 'review' && (
          <>
            <div className="ms-drawer-body">
              <button className="ms-back" onClick={() => setStep('cart')}>← {t.editCart}</button>
              <div className="ms-invoice">
                <div className="ms-inv-head">
                  {shop.logo && <img src={shop.logo} alt="" className="ms-inv-logo" />}
                  <div><div className="ms-inv-shop">{shop.name}</div>{shop.phone && <div className="ms-inv-sub" dir="ltr">{shop.phone}</div>}</div>
                </div>
                <table className="ms-inv-table">
                  <thead><tr><th>{t.colItem}</th><th className="c">{t.colQty}</th><th className="r">{t.colUnit}</th><th className="r">{t.colLine}</th></tr></thead>
                  <tbody>
                    {cartItems.map(({ p, qty, rate, line, hidden, optionText, cur }) => {
                      const showPrice = optionsOf(p).length > 0 || p.price != null;
                      return (
                      <tr key={p.id}>
                        <td>{pName(p)}{optionText && <span className="ms-inv-opt"> — {optionText}</span>}{p.sku && <span className="ms-inv-sku"> · {p.sku}</span>}</td>
                        <td className="c">{qty}{p.unit ? ` ${p.unit}` : ''}</td>
                        <td className="r">{hidden ? <span className="ms-inv-neg">{negLabel(p)}</span> : (showPrice ? money(rate, cur) : '—')}</td>
                        <td className="r b">{hidden ? <span className="ms-inv-neg">{negLabel(p)}</span> : (showPrice ? money(line, cur) : '—')}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!multiCur && (shopFees.length > 0 || (shop.discounts || []).length > 0 || taxRate > 0) ? (
                  <>
                    <div className="ms-inv-subtotal"><span>{t.subtotalLabel}</span><b>{money(grandTotal, displayCur)}</b></div>
                    {(shop.discounts || []).length > 0 && (
                      <div className="ms-disc">
                        <div className="ms-disc-title">{t.discountTitle}</div>
                        {appliedDiscount ? (
                          <div className="ms-disc-applied">
                            <span className="ms-disc-code">{appliedDiscount.code} {appliedDiscount.type === 'percent' ? `(${appliedDiscount.value}%)` : ''}</span>
                            <span className="ms-disc-amt">− {money(discountAmount, displayCur)}</span>
                            <button className="ms-disc-rm" onClick={removeDiscount}>✕</button>
                          </div>
                        ) : (
                          <div className="ms-disc-row">
                            <input value={discountInput} onChange={e => { setDiscountInput(e.target.value); setDiscountErr(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyDiscount(); } }} placeholder={t.discountPh} dir="ltr" />
                            <button onClick={applyDiscount}>{t.apply}</button>
                          </div>
                        )}
                        {discountErr && <p className="ms-disc-err">{discountErr}</p>}
                      </div>
                    )}
                    {shopFees.length > 0 && (
                      <div className="ms-fees">
                        <div className="ms-fees-title">{t.feesLabel}</div>
                        {shopFees.map(f => {
                          const on = f.required || selectedFees[f.id];
                          return (
                            <label key={f.id} className={`ms-fee ${on ? 'on' : ''} ${f.required ? 'req' : ''}`}>
                              <span className="ms-fee-left">
                                {!f.required && <input type="checkbox" checked={!!selectedFees[f.id]} onChange={() => toggleFee(f.id)} />}
                                <span>{L(f.label, f.labelEn)} {!f.required && <em>{t.optionalFee}</em>}</span>
                              </span>
                              <span className="ms-fee-amt">+ {money(f.amount, displayCur)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : null}
                {!multiCur && discountAmount > 0 && <div className="ms-inv-discount"><span>{t.discountLine} ({appliedDiscount?.code})</span><span>− {money(discountAmount, displayCur)}</span></div>}
                {!multiCur && taxRate > 0 && (
                  <div className="ms-inv-tax">
                    <span>{(L(shop.taxLabel, shop.taxLabelEn) || (taxInclusive ? t.taxIncl : t.taxExcl))} ({taxRate}%{taxInclusive ? ` · ${t.taxIncl}` : ''})</span>
                    <span>{taxInclusive ? '' : '+ '}{money(taxAmount, displayCur)}</span>
                  </div>
                )}
                <div className="ms-inv-total"><span>{t.total}</span><b>{allHidden ? negLabel() : (multiCur ? fmtTotals() : money(finalTotal, displayCur))}{!allHidden && anyHidden && <span className="ms-some-neg"> + {negLabel()}</span>}</b></div>
                <p className="ms-inv-hint">{t.invHint}</p>
              </div>
              <div className="ms-form embedded">
                <h3>{t.yourInfo}</h3>
                <div className="ms-grid2">
                  <input placeholder={`${t.name} *`} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                  <input placeholder={t.company} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="ms-grid2">
                  <input placeholder={`${t.phone} *`} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
                  <input placeholder={t.email} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
                </div>
                <div className="ms-grid2">
                  <input placeholder={t.country} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                  <input placeholder={t.city} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <textarea rows={2} placeholder={t.notes} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                {error && <p className="ms-err">{error}</p>}
              </div>
            </div>
            <div className="ms-checkout-bar">
              <button className="ms-submit" disabled={submitting} onClick={submit}>{submitting ? t.submitting : t.confirm}</button>
            </div>
          </>
        )}
      </aside>

      {/* Thank-you / tracking */}
      {tracking && (
        <div className="ms-thanks-ov">
          <div className="ms-thanks">
            <div className="ms-thanks-ic">✓</div>
            <h3>{t.thanksTitle}</h3>
            <p>{t.thanksDesc}</p>
            <div className="ms-track-code">
              <span className="ms-track-label">{t.trackingCode}</span>
              <div className="ms-track-val"><b dir="ltr">{tracking}</b>
                <button onClick={() => { navigator.clipboard.writeText(tracking); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t.copied : t.copy}</button>
              </div>
            </div>
            <button className="ms-submit" onClick={() => { setTracking(null); setForm({ customerName: '', company: '', phone: '', email: '', country: '', city: '', notes: '' }); }}>{t.close}</button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

// Custom content page (About Us, Certifications, Gallery, ...)
const PageView: React.FC<{ page: MetaShopPage; uiLang: string; L: (fa?: string, en?: string) => string }> = ({ page, uiLang, L }) => {
  const TR = (i18n: Record<string, Record<string, string>> | undefined, key: string, legacy: string) => (i18n && i18n[uiLang] && i18n[uiLang][key]) || legacy || '';
  const title = TR(page.i18n, 'label', L(page.label, page.labelEn));
  const desc = TR(page.i18n, 'description', L(page.description, page.descriptionEn));
  const paras = (TR(page.i18n, 'body', L(page.body, page.bodyEn)) || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const imgs = page.images || [];

  if (page.type === 'gallery') {
    return (
      <section className="ms-page">
        <h2 className="ms-page-title">{title}</h2>
        {desc && <p className="ms-page-desc">{desc}</p>}
        <div className="ms-gallery">{imgs.map((src, i) => <figure key={i} className="ms-gphoto"><img src={src} alt="" loading="lazy" /></figure>)}</div>
      </section>
    );
  }
  if (page.type === 'cards') {
    return (
      <section className="ms-page">
        <h2 className="ms-page-title">{title}</h2>
        {desc && <p className="ms-page-desc">{desc}</p>}
        <div className="ms-pcards">
          {(page.cards || []).map(c => (
            <div key={c.id} className="ms-pcard">
              {c.image && <div className="ms-pcard-imgwrap"><img src={c.image} alt="" loading="lazy" /></div>}
              <div className="ms-pcard-name">{TR(c.i18n, 'name', L(c.name, c.nameEn))}</div>
              {(c.desc || c.descEn || (c.i18n && c.i18n[uiLang] && c.i18n[uiLang].desc)) && <div className="ms-pcard-desc">{TR(c.i18n, 'desc', L(c.desc, c.descEn))}</div>}
            </div>
          ))}
        </div>
      </section>
    );
  }
  // text page — text on top, then a tidy square-image gallery below
  return (
    <section className="ms-page">
      <h2 className="ms-page-title">{title}</h2>
      <div className="ms-text-paras ms-text-narrow">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
      {imgs.length > 0 && (
        <div className="ms-gallery ms-text-gallery">
          {imgs.map((s, i) => <figure key={i} className="ms-gphoto"><img src={s} alt="" loading="lazy" /></figure>)}
        </div>
      )}
    </section>
  );
};

const MS_CSS = `
.ms-root { --ms-primary:#2d4a1a; background: var(--ms-bg,#fdfbf6); color: var(--ms-text,#2d3a24); min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
.ms-root * { box-sizing:border-box; }
/* Embedded (Google Sites / iframe) — compact cover so the catalog shows sooner inside a fixed-height frame */
.ms-root.ms-embed { min-height:100%; }
.ms-root.ms-embed .ms-cover { padding:40px 24px; min-height:150px; }
.ms-topbar { position:sticky; top:0; z-index:50; background:rgba(255,255,255,.97); backdrop-filter:blur(16px); border-bottom:1px solid #e8eaed; box-shadow:0 1px 8px rgba(0,0,0,.06); }
.ms-topbar-inner { max-width:1280px; margin:0 auto; padding:0 20px; height:58px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
.ms-brand { display:flex; align-items:center; gap:12px; min-width:0; }
.ms-logo { max-height:34px; width:auto; object-fit:contain; }
.ms-name { font-size:15px; font-weight:800; color:var(--ms-heading,#1f2a18); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ms-code { font-size:10px; font-family:ui-monospace,monospace; font-weight:800; letter-spacing:.08em; background:var(--ms-primary); color:#fff; padding:2px 7px; border-radius:6px; flex-shrink:0; }
.ms-cart-btn { display:flex; align-items:center; gap:8px; background:var(--ms-primary); color:#fff; border:none; padding:9px 18px; border-radius:999px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.15); white-space:nowrap; }
.ms-cat-btn { display:inline-flex; align-items:center; gap:7px; background:#fff; color:var(--ms-primary); border:1.5px solid var(--ms-primary); padding:7.5px 14px; border-radius:999px; font-size:13px; font-weight:700; cursor:pointer; text-decoration:none; white-space:nowrap; transition:background .15s,color .15s; }
.ms-cat-btn:hover { background:var(--ms-primary); color:#fff; }
.ms-embed .ms-cat-lbl { display:none; }
@media (max-width:560px){ .ms-cat-lbl { display:none; } }
.ms-foot-catalog { display:inline-flex; align-items:center; gap:9px; margin:26px auto 0; padding:12px 26px; background:rgba(255,255,255,.16); border:1.5px solid rgba(255,255,255,.5); color:#fff; border-radius:999px; font-size:14px; font-weight:800; text-decoration:none; cursor:pointer; transition:background .15s; }
.ms-foot-catalog:hover { background:rgba(255,255,255,.28); }
.ms-foot-actions { display:flex; flex-wrap:wrap; gap:12px; justify-content:center; align-items:center; margin-top:26px; }
.ms-foot-actions .ms-foot-catalog { margin:0; }
.ms-foot-refer { display:inline-flex; align-items:center; gap:9px; padding:12px 26px; background:#fff; color:var(--ms-primary); border:none; border-radius:999px; font-size:14px; font-weight:800; cursor:pointer; font-family:inherit; box-shadow:0 4px 18px rgba(0,0,0,.15); transition:transform .12s, box-shadow .12s; }
.ms-foot-refer:hover { transform:translateY(-1px); box-shadow:0 6px 22px rgba(0,0,0,.2); }
.ms-refer-modal { background:#fff; border-radius:22px; width:100%; max-width:720px; max-height:min(92vh,860px); display:flex; flex-direction:column; overflow:hidden; position:relative; box-shadow:0 24px 64px rgba(15,23,42,.28); }
.ms-refer-body { display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden; }
.ms-refer-form { flex:1; overflow-y:auto; padding:0 22px 12px; }
.ms-refer-section { margin-bottom:18px; }
.ms-refer-section h4 { margin:0 0 10px; font-size:13px; font-weight:800; color:var(--ms-heading); }
.ms-refer-ph-limit { font-weight:600; opacity:.55; font-size:11px; }
.ms-refer-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; }
@media (max-width:560px){ .ms-refer-grid { grid-template-columns:1fr; } }
.ms-refer-grid select { width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; font-family:inherit; font-size:14px; background:#fff; }
.ms-refer-photos { display:flex; flex-wrap:wrap; gap:8px; }
.ms-refer-ph { position:relative; width:72px; height:72px; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0; }
.ms-refer-ph img { width:100%; height:100%; object-fit:cover; }
.ms-refer-ph button { position:absolute; top:2px; inset-inline-end:2px; width:22px; height:22px; border:none; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; font-size:11px; cursor:pointer; }
.ms-refer-ph-add { width:72px; height:72px; border:2px dashed #cbd5e1; border-radius:10px; background:#f8fafc; color:#64748b; font-size:28px; font-weight:300; cursor:pointer; }
.ms-refer-ph-add:disabled { opacity:.5; cursor:default; }
.hidden { display:none !important; }
.ms-badge { background:rgba(255,255,255,.25); border-radius:999px; padding:1px 7px; font-size:11px; font-weight:800; }
.ms-top-actions { display:flex; align-items:center; gap:10px; }
.ms-lang { display:flex; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
.ms-lang button { padding:5px 9px; font-size:11px; font-weight:700; background:#fff; color:#64748b; border:none; cursor:pointer; }
.ms-lang button.on { background:var(--ms-primary); color:#fff; }
.ms-cover { background:var(--ms-cover,#2d4a1a); color:var(--ms-cover-text,#fff); padding:64px 24px; text-align:center; background-size:cover; background-position:center; min-height:240px; display:flex; align-items:center; justify-content:center; }
.ms-cover-inner { max-width:740px; }
.ms-collection { font-size:13px; letter-spacing:.35em; text-transform:uppercase; opacity:.8; margin-bottom:18px; }
.ms-cover h1 { font-size:clamp(26px,5vw,52px); font-weight:900; letter-spacing:-.02em; line-height:1.05; }
.ms-subtitle { font-size:clamp(15px,2.2vw,22px); opacity:.9; font-weight:300; margin-top:8px; }
.ms-container { max-width:1280px; margin:0 auto; padding:0 20px; }
/* tabs */
.ms-tabs { display:flex; justify-content:center; gap:8px; margin:24px auto 8px; padding:6px; width:max-content; max-width:100%; overflow-x:auto; background:rgba(15,23,42,.04); border:1px solid rgba(15,23,42,.08); border-radius:999px; scrollbar-width:none; }
.ms-tabs::-webkit-scrollbar { display:none; }
.ms-tab { border:0; background:transparent; color:#64748b; padding:9px 18px; border-radius:999px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; transition:all .18s; }
.ms-tab:hover { color:var(--ms-heading,#1f2a18); }
.ms-tab.active { background:#fff; color:var(--ms-heading,#1f2a18); box-shadow:0 8px 26px rgba(15,23,42,.10); }
/* content pages */
.ms-page { max-width:1000px; margin:40px auto 56px; animation:msFade .28s ease; }
@keyframes msFade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
.ms-page-title { text-align:center; font-size:13px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:var(--ms-primary); opacity:.85; margin-bottom:24px; }
.ms-page-desc { max-width:760px; margin:0 auto 28px; font-size:clamp(15px,2vw,19px); line-height:1.8; color:var(--ms-text); text-align:center; }
.ms-text { display:grid; gap:32px; max-width:880px; margin:0 auto; }
.ms-text.has-img { grid-template-columns:1fr; }
@media (min-width:760px){ .ms-text.has-img { grid-template-columns:1fr 1fr; gap:48px; align-items:center; } }
.ms-text-imgs { display:grid; gap:12px; }
.ms-text-imgs img { width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:16px; }
.ms-text-paras p { font-size:16px; line-height:1.85; color:var(--ms-text); margin-bottom:16px; }
.ms-text-paras p:first-child { font-size:clamp(17px,2.2vw,20px); font-weight:600; color:var(--ms-heading,#1f2a18); }
.ms-text-narrow { max-width:760px; margin:0 auto; }
.ms-text-gallery { margin-top:28px; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); }
.ms-gallery { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); }
.ms-gphoto { margin:0; aspect-ratio:1/1; border-radius:18px; overflow:hidden; background:#f1f5f9; border:1px solid #e2e8f0; }
.ms-gphoto img { width:100%; height:100%; object-fit:cover; }
.ms-pcards { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); }
@media (max-width:480px){ .ms-pcards { grid-template-columns:1fr 1fr; gap:12px; } }
.ms-pcard { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:20px 14px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.ms-pcard-imgwrap { width:84px; height:84px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.ms-pcard-imgwrap img { max-width:84px; max-height:84px; object-fit:contain; }
.ms-pcard-name { font-size:13px; font-weight:700; color:var(--ms-heading,#1f2a18); line-height:1.3; margin-bottom:6px; }
.ms-pcard-desc { font-size:11px; color:#64748b; line-height:1.5; }
.ms-tools { max-width:760px; margin:20px auto 6px; }
.ms-search { position:relative; }
.ms-search input { width:100%; border:1.5px solid #e2e8f0; border-radius:999px; padding:11px 42px 11px 16px; font-size:13px; outline:none; box-shadow:0 8px 26px rgba(15,23,42,.06); }
.ms-search input:focus { border-color:var(--ms-primary); }
.ms-search svg { position:absolute; inset-inline-end:15px; top:50%; transform:translateY(-50%); color:#94a3b8; }
.ms-filter-bar { display:flex; gap:8px; overflow-x:auto; padding:14px 2px 4px; scrollbar-width:none; scroll-behavior:smooth; -webkit-overflow-scrolling:touch; }
.ms-filter-bar::-webkit-scrollbar { display:none; }
.ms-pill-scroll { display:flex; align-items:center; gap:6px; padding:0 2px; }
.ms-pill-scroll-track { flex:1; min-width:0; position:relative; }
.ms-pill-scroll-track.fade-start::before,
.ms-pill-scroll-track.fade-end::after { content:''; position:absolute; top:0; bottom:0; width:32px; pointer-events:none; z-index:2; }
.ms-pill-scroll-track.fade-start::before { inset-inline-start:0; background:linear-gradient(90deg, var(--ms-bg,#fff) 30%, transparent); }
.ms-pill-scroll-track.fade-end::after { inset-inline-end:0; background:linear-gradient(270deg, var(--ms-bg,#fff) 30%, transparent); }
[dir="rtl"] .ms-pill-scroll-track.fade-start::before { background:linear-gradient(270deg, var(--ms-bg,#fff) 30%, transparent); }
[dir="rtl"] .ms-pill-scroll-track.fade-end::after { background:linear-gradient(90deg, var(--ms-bg,#fff) 30%, transparent); }
.ms-pill-arrow { flex-shrink:0; width:36px; height:36px; border-radius:50%; border:1.5px solid #e2e8f0; background:#fff; color:#475569; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 10px rgba(15,23,42,.08); transition:border-color .15s, color .15s, box-shadow .15s; }
.ms-pill-arrow:hover:not(.disabled) { border-color:var(--ms-primary); color:var(--ms-primary); box-shadow:0 4px 14px rgba(0,0,0,.12); }
.ms-pill-arrow.disabled { opacity:.3; cursor:default; box-shadow:none; }
.ms-pill { flex-shrink:0; padding:8px 18px; border-radius:999px; font-size:13px; font-weight:600; border:2px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; white-space:nowrap; }
.ms-pill.active { background:var(--ms-primary); border-color:var(--ms-primary); color:#fff; box-shadow:0 4px 12px rgba(0,0,0,.15); }
.ms-subfilter-bar { display:flex; gap:6px; overflow-x:auto; padding:6px 2px 4px; margin-top:2px; scrollbar-width:none; scroll-behavior:smooth; -webkit-overflow-scrolling:touch; }
.ms-subfilter-bar::-webkit-scrollbar { display:none; }
.ms-subfilter-bar::-webkit-scrollbar { display:none; }
.ms-subpill { flex-shrink:0; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; border-radius:999px; padding:6px 14px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap; }
.ms-subpill:hover { color:var(--ms-primary); border-color:var(--ms-primary); background:#fff; }
.ms-subpill.active { background:rgba(15,23,42,.06); border-color:var(--ms-primary); color:var(--ms-primary); }
.ms-subcat-badge { display:inline-block; font-size:10px; font-weight:800; padding:2px 7px; background:#ecfeff; color:#0e7490; border:1px solid #cffafe; border-radius:999px; }
.ms-empty { text-align:center; color:#94a3b8; padding:40px; font-size:14px; }
.ms-grid { display:grid; gap:16px; grid-template-columns:repeat(2,1fr); padding:14px 0 56px; }
@media (min-width:768px){ .ms-grid { grid-template-columns:repeat(3,1fr); } }
@media (min-width:1100px){ .ms-grid { grid-template-columns:repeat(4,1fr); } }
.ms-card { background:#fff; border:1px solid #eef0f3; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.06); display:flex; flex-direction:column; transition:box-shadow .2s, transform .2s; content-visibility:auto; contain-intrinsic-size:auto 300px; }
@media (hover:none) and (pointer:coarse){ .ms-card { transition:none; } }
.ms-card:hover { box-shadow:0 12px 32px rgba(0,0,0,.13); transform:translateY(-4px); }
.ms-card-img { position:relative; aspect-ratio:4/3; background:#f8fafc; cursor:zoom-in; overflow:hidden; }
.ms-card-img img { width:100%; height:100%; object-fit:cover; }
.ms-noimg { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:40px; font-weight:800; color:#cbd5e1; background:#f1f5f9; }
.ms-noimg.sm { width:56px; height:56px; font-size:20px; border-radius:8px; }
.ms-noimg.lg { font-size:80px; }
.ms-group-badge { position:absolute; top:10px; inset-inline-start:10px; background:var(--ms-primary); color:#fff; font-size:10px; padding:4px 10px; border-radius:999px; font-weight:700; }
.ms-card-body { padding:14px; flex:1; display:flex; flex-direction:column; gap:8px; }
.ms-pname { font-size:14px; font-weight:700; color:var(--ms-heading,#1f2a18); line-height:1.3; cursor:pointer; }
.ms-badges { display:flex; flex-wrap:wrap; gap:4px; }
.ms-sku { font-size:10px; font-family:ui-monospace,monospace; font-weight:700; padding:2px 7px; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; border-radius:5px; }
.ms-hs { font-size:10px; font-family:ui-monospace,monospace; padding:2px 7px; color:#64748b; }
.ms-stock { font-size:10px; font-weight:900; padding:2px 8px; background:#ecfdf5; color:#047857; border:1px solid #bbf7d0; border-radius:999px; }
.ms-desc { font-size:12px; color:#64748b; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ms-meta { display:flex; gap:10px; flex-wrap:wrap; font-size:11px; color:#64748b; padding:6px 0; border-top:1px solid #f1f5f9; }
.ms-meta b { color:#334155; }
.ms-prices { border-top:1px solid #f1f5f9; padding-top:10px; margin-top:auto; display:flex; flex-direction:column; gap:4px; }
.ms-price-amt { font-weight:800; font-size:15px; color:#0f172a; }
.ms-price-amt.ms-pack { font-size:13px; color:#475569; font-weight:700; }
.ms-price-unit { font-size:10px; font-weight:400; color:#94a3b8; }
.ms-buy { margin-top:auto; }
.ms-opts { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
.ms-opt { display:flex; flex-direction:column; align-items:flex-start; gap:1px; border:1.5px solid #e2e8f0; background:#fff; border-radius:9px; padding:4px 9px; cursor:pointer; transition:all .15s; min-width:0; }
.ms-opt.on { border-color:var(--ms-primary); background:color-mix(in srgb, var(--ms-primary) 8%, #fff); }
.ms-opt-label { font-size:10px; font-weight:700; color:#475569; line-height:1.2; }
.ms-opt.on .ms-opt-label { color:var(--ms-primary); }
.ms-opt-price { font-size:11px; font-weight:800; color:#0f172a; display:flex; flex-direction:column; line-height:1.15; }
.ms-opt-was { font-size:9px; font-weight:600; color:#94a3b8; text-decoration:line-through; }
/* discount: before/after price + badges */
.ms-price-row { display:flex; align-items:baseline; flex-wrap:wrap; gap:7px; }
.ms-price-was { font-size:12px; font-weight:600; color:#94a3b8; text-decoration:line-through; }
.ms-disc-tag { font-size:10px; font-weight:900; color:#dc2626; background:#fef2f2; border:1px solid #fecaca; padding:1px 7px; border-radius:999px; }
/* «قابل مذاکره» (price hidden) */
.ms-negotiable { font-size:13px; font-weight:800; color:var(--ms-primary); background:color-mix(in srgb, var(--ms-primary) 9%, #fff); border:1px dashed color-mix(in srgb, var(--ms-primary) 35%, #fff); padding:4px 10px; border-radius:8px; }
/* Out-of-stock (در حال حاضر موجود نیست) */
.ms-oos { font-size:13px; font-weight:800; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:8px 10px; border-radius:10px; text-align:center; }
.ms-oos-badge { position:absolute; top:8px; inset-inline-start:8px; z-index:2; font-size:11px; font-weight:800; color:#fff; background:rgba(185,28,28,.92); padding:4px 9px; border-radius:999px; box-shadow:0 2px 6px rgba(0,0,0,.2); }
.ms-card-oos .ms-card-img img { filter:grayscale(.7) opacity(.7); }
.ms-citem-neg { color:var(--ms-primary) !important; font-weight:800; }
.ms-inv-neg { color:var(--ms-primary); font-weight:800; font-size:11px; }
.ms-some-neg { font-size:11px; font-weight:700; color:var(--ms-primary); opacity:.85; }
.ms-disc-ribbon { position:absolute; top:10px; inset-inline-end:10px; background:#dc2626; color:#fff; font-size:11px; font-weight:900; padding:4px 9px; border-radius:999px; box-shadow:0 2px 8px rgba(220,38,38,.35); z-index:2; }
.ms-feat-badge { position:absolute; bottom:10px; inset-inline-start:10px; background:rgba(245,158,11,.96); color:#fff; font-size:10px; font-weight:900; padding:3px 9px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2); }
/* featured rail */
.ms-featured { margin:14px 0 4px; padding:16px; border:1px solid #fde68a; background:linear-gradient(135deg,#fffbeb,#fff7ed); border-radius:18px; }
.ms-featured-head { font-size:14px; font-weight:900; color:#b45309; display:flex; align-items:center; gap:7px; margin-bottom:12px; }
.ms-featured-star { color:#f59e0b; font-size:17px; }
.ms-featured-grid { display:grid; gap:14px; grid-template-columns:repeat(1,1fr); }
@media (min-width:640px){ .ms-featured-grid { grid-template-columns:repeat(2,1fr); } }
@media (min-width:1000px){ .ms-featured-grid { grid-template-columns:repeat(3,1fr); } }
.ms-card-feat { border-color:#fcd34d; box-shadow:0 4px 16px rgba(245,158,11,.18); }
.ms-add { margin-top:10px; padding:11px 12px; background:var(--ms-primary); color:#fff; font-size:13px; font-weight:700; border:none; border-radius:10px; cursor:pointer; width:100%; box-shadow:0 2px 8px rgba(0,0,0,.12); }
.ms-add.in { background:#10b981; }
.ms-add.lg { margin-top:8px; padding:13px; font-size:14px; }
.ms-add:active { transform:scale(.98); }
.ms-card-qty { margin-top:10px; display:flex; align-items:center; gap:8px; }
.ms-card-qty.big { margin-top:8px; }
.ms-card-qty > button { width:34px; height:34px; border:1.5px solid var(--ms-primary); background:#fff; color:var(--ms-primary); border-radius:9px; font-size:18px; font-weight:700; cursor:pointer; line-height:1; }
.ms-card-qty .ms-card-qnum { min-width:28px; text-align:center; font-weight:800; font-size:15px; color:#0f172a; }
.ms-card-qty .ms-card-qinp { width:64px; text-align:center; font-weight:800; font-size:15px; color:#0f172a; border:1.5px solid #e2e8f0; border-radius:8px; padding:5px 4px; outline:none; }
.ms-card-qty .ms-card-qinp:focus { border-color:var(--ms-primary); }
.ms-card-qty .ms-card-rm { width:30px; height:30px; border:none; background:transparent; color:#ef4444; font-size:13px; cursor:pointer; margin-inline-start:auto; }
.ms-card-calc { margin-top:7px; font-size:12px; color:#64748b; text-align:center; background:#f8fafc; border:1px solid #eef0f3; border-radius:8px; padding:5px 8px; }
.ms-card-calc b { color:var(--ms-primary); font-weight:800; }
.ms-citem-opt { font-size:11px; font-weight:700; color:var(--ms-primary); margin-top:1px; }
.ms-inv-opt { color:var(--ms-primary); font-weight:600; }
.ms-colors { display:flex; flex-wrap:wrap; gap:7px; }
.ms-color-chip { display:inline-flex; align-items:center; gap:5px; border:1px solid #e2e8f0; background:#f8fafc; border-radius:999px; padding:3px 9px 3px 4px; font-size:11px; font-weight:700; color:#475569; }
.ms-color-chip i { width:15px; height:15px; border-radius:50%; border:1px solid rgba(15,23,42,.18); }
.ms-feats { display:flex; flex-direction:column; gap:4px; }
.ms-feats > div { display:flex; justify-content:space-between; font-size:12px; border-bottom:1px solid #f1f5f9; padding:4px 0; }
.ms-feats span { color:#94a3b8; } .ms-feats b { color:#334155; }
.ms-re-specs-title { font-size:13px; font-weight:800; color:var(--ms-heading); margin:12px 0 6px; }
.ms-re-faq { margin-top:12px; }
.ms-re-faq-item { border:1px solid #e2e8f0; border-radius:10px; margin-bottom:6px; padding:8px 10px; font-size:12px; }
.ms-re-faq-item summary { cursor:pointer; font-weight:700; color:var(--ms-heading); }
.ms-re-faq-item p { margin:8px 0 0; color:var(--ms-text); line-height:1.5; }
.ms-re-inquiry .ms-re-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
.ms-re-inquiry .ms-re-actions.big { flex-direction:column; align-items:stretch; }
.ms-re-contact { display:inline-flex; align-items:center; gap:4px; padding:9px 14px; border-radius:999px; border:1px solid #e2e8f0; font-size:12px; font-weight:700; color:var(--ms-heading); text-decoration:none; background:#fff; }
.ms-re-contact.wa { border-color:#25d366; color:#128c7e; }
.ms-re-agent-block { margin-top:10px; padding-top:10px; border-top:1px solid #e2e8f0; }
.ms-re-agent-name { display:block; font-size:13px; font-weight:800; color:var(--ms-heading); margin-bottom:6px; }
.ms-footer a { color:inherit; text-decoration:underline; text-underline-offset:2px; }
.ms-footer a:hover { color:var(--ms-primary); }
/* real-estate inquiry modal */
.ms-inquiry-modal { background:#fff; border-radius:22px; width:100%; max-width:720px; max-height:min(92vh,780px); display:flex; flex-direction:column; overflow:hidden; position:relative; box-shadow:0 24px 64px rgba(15,23,42,.28); }
.ms-inq-close { position:absolute; top:14px; inset-inline-end:14px; z-index:20; width:38px; height:38px; border-radius:50%; border:none; background:#fff; color:#475569; cursor:pointer; font-size:15px; box-shadow:0 2px 12px rgba(15,23,42,.15); transition:background .15s, transform .15s; }
.ms-inq-close:hover { background:#f8fafc; transform:scale(1.04); }
.ms-inq-close:disabled { opacity:.5; cursor:not-allowed; }
.ms-inq-layout { display:flex; flex:1; min-height:0; flex-direction:row; }
.ms-inq-aside { width:38%; min-width:220px; max-width:280px; background:linear-gradient(165deg, var(--ms-primary) 0%, color-mix(in srgb, var(--ms-primary) 72%, #0f172a) 100%); color:#fff; display:flex; flex-direction:column; flex-shrink:0; }
.ms-inq-img-wrap { width:100%; aspect-ratio:4/3; background:rgba(0,0,0,.18); overflow:hidden; flex-shrink:0; }
.ms-inq-img-wrap img { width:100%; height:100%; object-fit:cover; display:block; }
.ms-inq-img-ph { display:flex; align-items:center; justify-content:center; font-size:42px; font-weight:800; opacity:.45; }
.ms-inq-aside-body { padding:18px 18px 22px; display:flex; flex-direction:column; gap:8px; flex:1; overflow-y:auto; }
.ms-inq-badge { align-self:flex-start; font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.28); border-radius:999px; padding:3px 10px; }
.ms-inq-prop-name { font-size:16px; font-weight:800; line-height:1.45; margin:0; }
.ms-inq-chips { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:5px; }
.ms-inq-chips li { font-size:11px; font-weight:600; background:rgba(255,255,255,.14); border-radius:6px; padding:3px 8px; }
.ms-inq-price { font-size:18px; font-weight:800; margin:4px 0 0; letter-spacing:.01em; }
.ms-inq-sku { font-size:11px; font-family:ui-monospace,monospace; opacity:.75; margin:0; }
.ms-inq-aside-hint { font-size:11px; line-height:1.55; opacity:.8; margin-top:auto; padding-top:10px; border-top:1px solid rgba(255,255,255,.2); }
.ms-inq-main { flex:1; min-width:0; display:flex; flex-direction:column; min-height:0; background:#fff; }
.ms-inq-head { flex-shrink:0; padding:22px 52px 14px 22px; border-bottom:1px solid #f1f5f9; }
.ms-inq-head h2 { font-size:18px; font-weight:800; color:var(--ms-heading,#0f172a); margin:0 0 6px; }
.ms-inq-head p { font-size:13px; color:#64748b; line-height:1.55; margin:0; }
.ms-inq-form-wrap { flex:1; overflow-y:auto; min-height:0; padding:16px 22px; }
.ms-inq-form { display:grid; grid-template-columns:1fr 1fr; gap:12px 14px; }
.ms-inq-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
.ms-inq-field-full { grid-column:1 / -1; }
.ms-inq-field span { font-size:12px; font-weight:700; color:#475569; }
.ms-inq-field span em { color:#ef4444; font-style:normal; }
.ms-inq-field input, .ms-inq-field textarea { width:100%; padding:11px 13px; border:1.5px solid #e2e8f0; border-radius:11px; font-size:14px; font-family:inherit; background:#fff; color:#0f172a; outline:none; transition:border-color .15s, box-shadow .15s; }
.ms-inq-field input::placeholder, .ms-inq-field textarea::placeholder { color:#94a3b8; }
.ms-inq-field input:focus, .ms-inq-field textarea:focus { border-color:var(--ms-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--ms-primary) 18%, transparent); }
.ms-inq-field textarea { resize:vertical; min-height:84px; line-height:1.5; }
.ms-inq-foot { flex-shrink:0; padding:12px 22px 20px; border-top:1px solid #f1f5f9; background:#fafbfc; }
.ms-inq-foot .ms-err { margin:0 0 8px; font-size:12px; }
.ms-inq-submit { width:100%; margin:0; padding:14px 18px; background:var(--ms-primary); color:#fff; font-size:15px; font-weight:800; border:none; border-radius:12px; cursor:pointer; box-shadow:0 4px 14px color-mix(in srgb, var(--ms-primary) 35%, transparent); transition:transform .12s, opacity .12s; }
.ms-inq-submit:hover:not(:disabled) { transform:translateY(-1px); }
.ms-inq-submit:active:not(:disabled) { transform:scale(.99); }
.ms-inq-submit:disabled { opacity:.65; cursor:not-allowed; }
.ms-inq-success { padding:36px 28px 32px; text-align:center; max-width:420px; margin:0 auto; }
.ms-inq-success-ic { width:60px; height:60px; border-radius:50%; background:#10b981; color:#fff; font-size:28px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
.ms-inq-success h2 { font-size:20px; font-weight:800; color:#0f172a; margin:0 0 8px; }
.ms-inq-success p { font-size:14px; color:#64748b; line-height:1.6; margin:0 0 18px; }
.ms-inq-success .ms-track-code { text-align:center; margin-bottom:16px; }
@media (max-width:640px){
  .ms-inquiry-modal { max-height:94vh; border-radius:18px; }
  .ms-inq-layout { flex-direction:column; }
  .ms-inq-aside { width:100%; max-width:none; min-width:0; flex-direction:row; align-items:stretch; }
  .ms-inq-img-wrap { width:110px; aspect-ratio:1; flex-shrink:0; }
  .ms-inq-aside-body { padding:14px 16px; gap:6px; }
  .ms-inq-prop-name { font-size:14px; }
  .ms-inq-price { font-size:16px; }
  .ms-inq-aside-hint { display:none; }
  .ms-inq-form { grid-template-columns:1fr; }
  .ms-inq-head { padding:18px 48px 12px 18px; }
  .ms-inq-form-wrap { padding:14px 18px; }
  .ms-inq-foot { padding:10px 18px 18px; }
}
/* footer */
.ms-footer { background:var(--ms-primary); color:#fff; padding:48px 24px 36px; text-align:center; margin-top:24px; }
.ms-foot-grid { display:grid; gap:8px; max-width:480px; margin:0 auto; font-size:15px; }
.ms-foot-grid b { font-size:13px; opacity:.85; }
.ms-foot-text { font-size:12px; opacity:.6; margin-top:20px; }
/* modal */
.ms-modal-ov { position:fixed; inset:0; z-index:9000; background:rgba(0,0,0,.72); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; overscroll-behavior:contain; }
.ms-modal { background:#fff; border-radius:20px; width:100%; max-width:820px; max-height:90vh; display:flex; overflow:hidden; position:relative; min-height:0; }
.ms-modal-x { position:absolute; top:12px; inset-inline-end:12px; z-index:10; width:36px; height:36px; border-radius:50%; border:none; background:rgba(15,23,42,.08); color:#475569; cursor:pointer; font-size:14px; }
.ms-modal-gal { width:46%; background:#f8fafc; display:flex; flex-direction:column; flex-shrink:0; min-height:0; overflow:hidden; }
.ms-gal-main { position:relative; flex:1; min-height:200px; display:flex; align-items:center; justify-content:center; background:#f8fafc; overflow:hidden; }
.ms-gal-main img { width:100%; height:100%; max-height:62vh; object-fit:contain; display:block; }
.ms-gal-nav { position:absolute; top:50%; transform:translateY(-50%); width:34px; height:34px; border-radius:50%; border:none; background:rgba(255,255,255,.9); color:#334155; font-size:22px; line-height:1; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.18); display:flex; align-items:center; justify-content:center; }
.ms-gal-nav.prev { inset-inline-start:8px; } .ms-gal-nav.next { inset-inline-end:8px; }
.ms-thumbs { display:flex; gap:6px; padding:8px; overflow-x:auto; background:#fff; border-top:1px solid #eef0f3; scrollbar-width:none; flex-shrink:0; }
.ms-thumbs::-webkit-scrollbar { display:none; }
.ms-thumb { flex-shrink:0; width:48px; height:48px; border-radius:8px; overflow:hidden; border:2px solid transparent; background:#f1f5f9; cursor:pointer; padding:0; }
.ms-thumb.on { border-color:var(--ms-primary); }
.ms-thumb img { width:100%; height:100%; object-fit:cover; }
.ms-video { position:relative; width:100%; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:#000; }
.ms-video iframe, .ms-video video { width:100%; height:100%; border:0; display:block; }
.ms-video-link { display:inline-flex; align-items:center; gap:6px; color:var(--ms-primary); font-weight:700; font-size:13px; text-decoration:underline; }
.ms-media-badges { position:absolute; bottom:8px; inset-inline-end:8px; display:flex; gap:5px; }
.ms-media-badge { background:rgba(15,23,42,.7); color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; backdrop-filter:blur(4px); }
.ms-modal-info { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; padding:28px 24px; display:flex; flex-direction:column; gap:12px; }
.ms-modal-info h2 { font-size:22px; font-weight:800; color:var(--ms-heading,#1f2a18); }
.ms-modal-desc { font-size:14px; line-height:1.75; color:var(--ms-text); white-space:pre-line; }
@media (max-width:600px){
  .ms-modal-ov { padding:0; align-items:stretch; backdrop-filter:none; -webkit-backdrop-filter:none; background:rgba(0,0,0,.55); }
  .ms-modal { flex-direction:column; max-height:100dvh; height:100dvh; border-radius:0; width:100%; }
  .ms-modal-gal { width:100%; flex:0 0 auto; max-height:min(44dvh, 300px); }
  .ms-gal-main { flex:0 0 auto; min-height:0; max-height:min(38dvh, 260px); }
  .ms-gal-main img { max-height:min(38dvh, 260px); height:auto; width:100%; }
  .ms-noimg.lg { max-height:min(38dvh, 260px); font-size:56px; }
  .ms-modal-info { flex:1 1 auto; padding:18px 16px calc(20px + env(safe-area-inset-bottom, 0px)); }
  .ms-modal-info h2 { font-size:18px; }
  .ms-modal-x { top:max(10px, env(safe-area-inset-top, 0px)); background:rgba(255,255,255,.94); box-shadow:0 2px 10px rgba(0,0,0,.12); }
  .ms-cart-ov { backdrop-filter:none; -webkit-backdrop-filter:none; }
}
/* drawer */
.ms-cart-ov { position:fixed; inset:0; background:rgba(15,23,42,.55); backdrop-filter:blur(4px); z-index:1100; opacity:0; pointer-events:none; transition:opacity .25s; }
.ms-cart-ov.open { opacity:1; pointer-events:auto; }
.ms-drawer { position:fixed; top:0; inset-inline-end:0; height:100%; width:min(440px,100vw); background:#fff; z-index:1200; transform:translateX(100%); transition:transform .3s; display:flex; flex-direction:column; box-shadow:-20px 0 40px rgba(0,0,0,.2); }
.ms-root[dir="rtl"] .ms-drawer { transform:translateX(-100%); }
.ms-drawer.open { transform:translateX(0); }
.ms-root[dir="rtl"] .ms-drawer.open { transform:translateX(0); }
.ms-drawer-head { flex-shrink:0; padding:18px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:var(--ms-primary); color:#fff; }
.ms-drawer-head h2 { font-size:17px; font-weight:800; }
.ms-drawer-head button { background:rgba(255,255,255,.15); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; }
.ms-drawer-body { flex:1; overflow-y:auto; padding:16px; }
.ms-cart-empty { text-align:center; color:#94a3b8; padding:40px 20px; }
.ms-citem { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #f1f5f9; }
.ms-citem img { width:56px; height:56px; object-fit:cover; border-radius:8px; flex-shrink:0; }
.ms-citem-info { flex:1; min-width:0; }
.ms-citem-name { font-size:13px; font-weight:700; color:#0f172a; }
.ms-citem-sku { font-size:11px; font-family:ui-monospace,monospace; color:#64748b; margin-top:2px; }
.ms-citem-row { display:flex; align-items:center; gap:10px; margin-top:8px; }
.ms-qty { display:inline-flex; align-items:center; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; }
.ms-qty button { width:28px; height:28px; border:none; background:#f8fafc; color:#475569; cursor:pointer; font-size:16px; font-weight:700; }
.ms-qty input { width:46px; height:28px; border:none; text-align:center; font-size:13px; font-weight:600; outline:none; }
.ms-rm { background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; }
.ms-citem-price { font-size:13px; font-weight:700; color:#0f172a; margin-top:6px; }
.ms-summary { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#f8fafc; border-top:1px solid #e2e8f0; font-size:16px; font-weight:800; color:#0f172a; }
.ms-form { padding:12px 16px; border-top:1px solid #e2e8f0; background:#f8fafc; max-height:46vh; overflow-y:auto; }
.ms-form h3 { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#0f172a; margin-bottom:8px; }
.ms-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
.ms-form input, .ms-form textarea { width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; outline:none; font-family:inherit; background:#fff; margin-bottom:8px; }
.ms-grid2 input { margin-bottom:0; }
.ms-form input:focus, .ms-form textarea:focus { border-color:var(--ms-primary); }
.ms-err { color:#ef4444; font-size:12px; margin-bottom:8px; }
.ms-submit { width:100%; padding:12px; background:var(--ms-primary); color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,.15); }
.ms-submit:disabled { opacity:.6; cursor:not-allowed; }
.ms-checkout-bar { flex-shrink:0; padding:12px 16px; border-top:1px solid #e2e8f0; background:#fff; }
.ms-checkout-bar .ms-summary { background:transparent; border:0; padding:0 0 10px; }
.ms-back { background:none; border:none; color:#64748b; font-size:13px; cursor:pointer; margin-bottom:10px; }
.ms-form.embedded { padding:14px 0 0; border:0; background:transparent; max-height:none; }
.ms-invoice { border:1px solid #e2e8f0; border-radius:14px; padding:14px; background:#fff; }
.ms-inv-head { display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:2px solid var(--ms-primary); margin-bottom:10px; }
.ms-inv-logo { height:34px; object-fit:contain; }
.ms-inv-shop { font-weight:800; color:var(--ms-heading,#0f172a); font-size:14px; }
.ms-inv-sub { font-size:11px; color:#94a3b8; }
.ms-inv-table { width:100%; border-collapse:collapse; font-size:12px; }
.ms-inv-table th { text-align:start; color:#94a3b8; font-weight:600; font-size:10px; text-transform:uppercase; padding:4px 4px; border-bottom:1px solid #f1f5f9; }
.ms-inv-table td { padding:7px 4px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:top; }
.ms-inv-table .c { text-align:center; } .ms-inv-table .r { text-align:end; } .ms-inv-table .b { font-weight:800; color:#0f172a; }
.ms-inv-sku { color:#94a3b8; font-size:10px; }
.ms-inv-subtotal { display:flex; justify-content:space-between; align-items:center; padding-top:8px; margin-top:4px; border-top:1px solid #f1f5f9; font-size:12px; color:#475569; }
.ms-inv-subtotal b { color:#0f172a; }
.ms-fees { margin-top:8px; border-top:1px solid #f1f5f9; padding-top:8px; }
.ms-fees-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#94a3b8; margin-bottom:5px; }
.ms-fee { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:5px 0; font-size:12px; color:#475569; cursor:pointer; }
.ms-fee.req { cursor:default; }
.ms-fee-left { display:flex; align-items:center; gap:7px; }
.ms-fee-left input { width:15px; height:15px; accent-color:var(--ms-primary); }
.ms-fee em { font-style:normal; font-size:10px; color:#94a3b8; }
.ms-fee.on { color:#0f172a; }
.ms-fee-amt { font-weight:700; color:#334155; white-space:nowrap; }
.ms-disc { margin-top:8px; border-top:1px solid #f1f5f9; padding-top:8px; }
.ms-disc-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#94a3b8; margin-bottom:5px; }
.ms-disc-row { display:flex; gap:6px; }
.ms-disc-row input { flex:1; min-width:0; padding:8px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; text-transform:uppercase; }
.ms-disc-row input:focus { border-color:var(--ms-primary); }
.ms-disc-row button { padding:8px 16px; background:var(--ms-primary); color:#fff; border:none; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; }
.ms-disc-applied { display:flex; align-items:center; gap:8px; background:#ecfdf5; border:1px solid #bbf7d0; border-radius:8px; padding:7px 10px; }
.ms-disc-code { font-weight:800; color:#047857; font-size:13px; letter-spacing:.03em; }
.ms-disc-amt { color:#047857; font-weight:700; margin-inline-start:auto; }
.ms-disc-rm { background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px; }
.ms-disc-err { color:#ef4444; font-size:11px; margin-top:5px; }
.ms-inv-discount { display:flex; justify-content:space-between; align-items:center; padding-top:6px; font-size:12px; color:#047857; font-weight:700; }
.ms-inv-tax { display:flex; justify-content:space-between; align-items:center; padding-top:6px; font-size:12px; color:#64748b; }
.ms-inv-total { display:flex; justify-content:space-between; align-items:center; padding-top:10px; margin-top:6px; border-top:2px solid var(--ms-primary); font-size:15px; font-weight:800; color:#0f172a; }
.ms-inv-hint { font-size:10px; color:#94a3b8; margin-top:8px; line-height:1.4; }
/* track link */
.ms-track-link { text-align:center; padding:0 0 48px; }
.ms-track-link > button { background:none; border:none; color:var(--ms-primary); font-weight:700; font-size:13px; cursor:pointer; text-decoration:underline; }
.ms-track-box { max-width:420px; margin:14px auto 0; }
.ms-track-row { display:flex; gap:8px; }
.ms-track-row input { flex:1; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; }
.ms-track-row button { padding:9px 18px; background:var(--ms-primary); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer; }
.ms-track-hint { color:#94a3b8; font-size:12px; margin:0 0 10px; line-height:1.6; text-align:start; }
.ms-track-fields { display:flex; flex-wrap:wrap; gap:8px; }
.ms-track-fields input { flex:1 1 140px; min-width:0; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; }
.ms-track-fields button { flex:1 1 100%; padding:9px 18px; background:var(--ms-primary); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer; }
.ms-track-fields button:disabled { opacity:.6; cursor:default; }
.ms-track-empty { color:#94a3b8; font-size:13px; padding:14px; }
.ms-track-list { margin-top:12px; display:flex; flex-direction:column; gap:8px; }
.ms-track-item { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; text-align:start; font-size:13px; }
.ms-track-sub { font-size:11px; color:#64748b; margin-top:3px; }
.ms-status { font-weight:700; color:var(--ms-primary); }
/* thanks */
.ms-thanks-ov { position:fixed; inset:0; background:rgba(15,23,42,.7); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(6px); }
.ms-thanks { background:#fff; padding:32px 28px; border-radius:24px; max-width:400px; text-align:center; }
.ms-thanks-ic { width:64px; height:64px; border-radius:50%; background:#10b981; color:#fff; font-size:32px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
.ms-thanks h3 { font-size:20px; font-weight:800; color:#0f172a; margin-bottom:8px; }
.ms-thanks p { font-size:14px; color:#64748b; line-height:1.6; margin-bottom:18px; }
.ms-track-code { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px; padding:14px; margin-bottom:18px; }
.ms-track-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
.ms-track-val { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:8px; }
.ms-track-val b { font-size:20px; font-family:ui-monospace,monospace; color:#0f172a; letter-spacing:.05em; }
.ms-track-val button { background:var(--ms-primary); color:#fff; border:none; padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; }
`;
