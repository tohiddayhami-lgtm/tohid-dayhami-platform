import type { MetaShopProduct, MetaShopRealEstate, MetaShopRealEstateFaq } from '../types';
import { formatInvoiceAmount } from './invoiceMoney';

export type { MetaShopLang } from '../types';
export { DEFAULT_REALESTATE_LANGS, DEFAULT_PRODUCT_LANGS, resolveShopLanguages } from './metaShopLang';

type Tri = { fa: string; en: string; ar: string };
type ReExt = MetaShopRealEstate & Record<string, unknown>;
type ProdI18n = Record<string, Record<string, unknown>> | undefined;

/** Built-in fa/ar/en labels; other language codes fall back to English */
const pick = (t: Tri, lang: string) => {
  if (lang === 'fa') return t.fa;
  if (lang === 'ar') return t.ar || t.en || t.fa;
  return t.en || t.fa;
};

const L3 = (fa: string, en: string, ar: string, lang: string) => pick({ fa, en, ar }, lang);

const langSlice = (re: ReExt, lang: string, productI18n?: ProdI18n): Record<string, unknown> | undefined => {
  const fromRe = re.i18n?.[lang];
  if (fromRe && typeof fromRe === 'object') return fromRe as Record<string, unknown>;
  const fromProd = productI18n?.[lang]?.realEstate;
  if (fromProd && typeof fromProd === 'object') return fromProd as Record<string, unknown>;
  return undefined;
};

const suffixValue = (re: ReExt, field: string, lang: string): unknown => {
  if (lang === 'ar') {
    const ar = re[`${field}Ar`];
    if (ar != null && ar !== '') return ar;
  }
  if (lang !== 'fa') {
    const en = re[`${field}En`];
    if (en != null && en !== '') return en;
  }
  return undefined;
};

/** Localized text field — fa base, then i18n / *En / *Ar / product.i18n.realEstate */
export const resolveReText = (
  re: MetaShopRealEstate | undefined,
  field: string,
  lang: string,
  productI18n?: ProdI18n,
): string | undefined => {
  if (!re) return undefined;
  const ext = re as ReExt;
  if (lang !== 'fa') {
    const slice = langSlice(ext, lang, productI18n);
    const fromSlice = slice?.[field];
    if (fromSlice != null && fromSlice !== '') return String(fromSlice);
    const suffixed = suffixValue(ext, field, lang);
    if (suffixed != null && suffixed !== '') return String(suffixed);
    const enSlice = langSlice(ext, 'en', productI18n);
    const fromEn = enSlice?.[field];
    if (fromEn != null && fromEn !== '') return String(fromEn);
    const enSuffix = suffixValue(ext, field, 'en');
    if (enSuffix != null && enSuffix !== '') return String(enSuffix);
  }
  const base = ext[field];
  if (base == null || base === '') return undefined;
  return typeof base === 'string' ? base : String(base);
};

/** Localized string array (amenities, nearbyPlaces, …) */
export const resolveReStringList = (
  re: MetaShopRealEstate | undefined,
  field: string,
  lang: string,
  productI18n?: ProdI18n,
): string[] | undefined => {
  if (!re) return undefined;
  const ext = re as ReExt;
  const asStrings = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v) || !v.length) return undefined;
    return v.map(x => String(x)).filter(Boolean);
  };
  if (lang !== 'fa') {
    const slice = langSlice(ext, lang, productI18n);
    const fromSlice = asStrings(slice?.[field]);
    if (fromSlice) return fromSlice;
    const suffixed = asStrings(suffixValue(ext, field, lang));
    if (suffixed) return suffixed;
    const enSlice = langSlice(ext, 'en', productI18n);
    const fromEn = asStrings(enSlice?.[field]);
    if (fromEn) return fromEn;
    const enList = asStrings(suffixValue(ext, field, 'en'));
    if (enList) return enList;
  }
  return asStrings(ext[field]);
};

export const realEstateFaqs = (
  re: MetaShopRealEstate | undefined,
  lang: string,
  productI18n?: ProdI18n,
): MetaShopRealEstateFaq[] => {
  if (!re) return [];
  const ext = re as ReExt;
  if (lang !== 'fa') {
    const fromSlice = langSlice(ext, lang, productI18n)?.faq;
    if (Array.isArray(fromSlice) && fromSlice.length) return fromSlice as MetaShopRealEstateFaq[];
    const fromProd = productI18n?.[lang]?.realEstate as { faq?: MetaShopRealEstateFaq[] } | undefined;
    if (fromProd?.faq?.length) return fromProd.faq;
    const fromEn = langSlice(ext, 'en', productI18n)?.faq;
    if (Array.isArray(fromEn) && fromEn.length) return fromEn as MetaShopRealEstateFaq[];
  }
  return re.faq || [];
};

export const DEAL_TYPE_LABEL: Record<string, Tri> = {
  sale: { fa: 'فروش', en: 'For Sale', ar: 'للبيع' },
  rent: { fa: 'اجاره', en: 'For Rent', ar: 'للإيجار' },
  'rent-short': { fa: 'اجاره کوتاه‌مدت', en: 'Short-term Rent', ar: 'إيجار قصير' },
  'pre-sale': { fa: 'پیش‌فروش', en: 'Pre-sale', ar: 'بيع على الخارطة' },
  exchange: { fa: 'معاوضه', en: 'Exchange', ar: 'مقايضة' },
};

export const PROPERTY_TYPE_LABEL: Record<string, Tri> = {
  apartment: { fa: 'آپارتمان', en: 'Apartment', ar: 'شقة' },
  villa: { fa: 'ویلا', en: 'Villa', ar: 'فيلا' },
  penthouse: { fa: 'پنت‌هاوس', en: 'Penthouse', ar: 'بنتهاوس' },
  studio: { fa: 'سوئیت / استودیو', en: 'Studio', ar: 'استوديو' },
  shop: { fa: 'مغازه تجاری', en: 'Retail Shop', ar: 'محل تجاري' },
  office: { fa: 'دفتر اداری', en: 'Office', ar: 'مكتب' },
  warehouse: { fa: 'انبار', en: 'Warehouse', ar: 'مستودع' },
  industrial: { fa: 'کارگاه / صنعتی', en: 'Industrial', ar: 'صناعي' },
  land: { fa: 'زمین', en: 'Land', ar: 'أرض' },
  building: { fa: 'ساختمان', en: 'Building', ar: 'مبنى' },
  hotel: { fa: 'هتل / مهمان‌پذیر', en: 'Hospitality', ar: 'ضيافة' },
};

export const propertyTypeLabel = (code: string | undefined, lang: string) => {
  if (!code) return '';
  const known = PROPERTY_TYPE_LABEL[code];
  if (known) return pick(known, lang);
  return code;
};

export const dealTypeLabel = (code: string | undefined, lang: string) => {
  if (!code) return '';
  const known = DEAL_TYPE_LABEL[code];
  if (known) return pick(known, lang);
  return code;
};

export const formatMoney = (n: number | undefined, currency: string, _lang: string) => {
  if (n == null || !n) return '';
  return `${formatInvoiceAmount(n, 0)} ${currency}`;
};

export const realEstateFaqText = (f: MetaShopRealEstateFaq, part: 'q' | 'a', lang: string): string => {
  const fromI18n = f.i18n?.[lang]?.[part];
  if (fromI18n) return fromI18n;
  if (lang === 'fa') return part === 'q' ? f.q : f.a;
  if (lang === 'ar') {
    if (part === 'q') return f.qAr || f.qEn || f.q;
    return f.aAr || f.aEn || f.a;
  }
  if (part === 'q') return f.qEn || f.q;
  return f.aEn || f.a;
};

/** خلاصه برای کارت لیست */
export const realEstateCardSummary = (p: MetaShopProduct, lang: string): string[] => {
  const re = p.realEstate;
  if (!re) return [];
  const lines: string[] = [];
  if (re.areaSqm) {
    lines.push(lang === 'fa' ? `${re.areaSqm} متر` : lang === 'ar' ? `${re.areaSqm} م²` : `${re.areaSqm} m²`);
  }
  if (re.bedrooms != null) {
    lines.push(lang === 'fa' ? `${re.bedrooms} خواب` : lang === 'ar' ? `${re.bedrooms} غرف نوم` : `${re.bedrooms} bed`);
  }
  if (re.bathrooms != null) {
    lines.push(lang === 'fa' ? `${re.bathrooms} حمام` : lang === 'ar' ? `${re.bathrooms} حمام` : `${re.bathrooms} bath`);
  }
  if (re.floor != null) {
    lines.push(lang === 'fa' ? `طبقه ${re.floor}` : lang === 'ar' ? `الطابق ${re.floor}` : `Floor ${re.floor}`);
  }
  const district = resolveReText(re, 'district', lang, p.i18n);
  const city = resolveReText(re, 'city', lang, p.i18n);
  if (district || city) lines.push([district, city].filter(Boolean).join(' · '));
  return lines;
};

/** ردیف‌های مشخصات برای مودال جزئیات */
export const realEstateDetailRows = (p: MetaShopProduct, lang: string): { label: string; value: string }[] => {
  const re = p.realEstate;
  if (!re) return [];
  const i18n = p.i18n as ProdI18n;
  const L = (fa: string, en: string, ar: string) => L3(fa, en, ar, lang);
  const T = (field: string) => resolveReText(re, field, lang, i18n);
  const cur = re.rentCurrency || p.currency || 'IRR';
  const rows: { label: string; value: string }[] = [];

  const push = (fa: string, en: string, ar: string, val: string | number | boolean | undefined | null) => {
    if (val === undefined || val === null || val === '') return;
    if (typeof val === 'boolean') rows.push({ label: L(fa, en, ar), value: val ? L('بله', 'Yes', 'نعم') : L('خیر', 'No', 'لا') });
    else rows.push({ label: L(fa, en, ar), value: String(val) });
  };

  push('نوع معامله', 'Deal', 'نوع الصفقة', dealTypeLabel(re.dealType, lang));
  push('نوع ملک', 'Property', 'نوع العقار', propertyTypeLabel(re.propertyType, lang) || re.propertyType);
  push('کاربری', 'Usage', 'الاستخدام', T('usage'));
  push('متراژ بنا', 'Built area', 'مساحة البناء', re.areaSqm ? `${re.areaSqm} m²` : undefined);
  push('متراژ زمین', 'Land area', 'مساحة الأرض', re.landAreaSqm ? `${re.landAreaSqm} m²` : undefined);
  push('اتاق خواب', 'Bedrooms', 'غرف النوم', re.bedrooms);
  push('حمام', 'Bathrooms', 'الحمامات', re.bathrooms);
  push('طبقه', 'Floor', 'الطابق', re.floor != null ? `${re.floor} / ${re.totalFloors ?? '?'}` : undefined);
  push('سال ساخت', 'Year built', 'سنة البناء', re.yearBuilt);
  push('نوساز / بازسازی', 'Renovation', 'التجديد', re.renovatedYear != null ? re.renovatedYear : T('renovation'));
  push('جهت', 'Facing', 'الاتجاه', T('facing'));
  push('نما', 'View', 'الإطلالة', T('view'));
  push('نوع سند', 'Title deed', 'نوع السند', T('documentType'));
  push('مالکیت', 'Ownership', 'الملكية', T('ownership'));
  push('وضعیت سکونت', 'Occupancy', 'حالة الإشغال', T('occupancyStatus'));
  push('مبله', 'Furnished', 'مفروش', T('furnished'));
  const parkingType = T('parkingType');
  push('پارکینگ', 'Parking', 'موقف سيارات', re.parkingSpaces != null ? `${re.parkingSpaces}${parkingType ? ` (${parkingType})` : ''}` : undefined);
  push('انباری', 'Storage', 'مخزن', re.storage);
  push('بالکن', 'Balcony', 'شرفة', re.balcony);
  push('آسانسور', 'Elevator', 'مصعد', re.elevator);
  push('آسانسور بار', 'Freight elevator', 'مصعد بضائع', re.freightElevator);
  push('گرمایش', 'Heating', 'تدفئة', T('heating'));
  push('سرمایش', 'Cooling', 'تبريد', T('cooling'));
  push('کف', 'Flooring', 'الأرضيات', T('flooring'));
  push('آشپزخانه', 'Kitchen', 'المطبخ', T('kitchen'));

  if (re.dealType === 'rent' || re.dealType === 'rent-short') {
    push('اجاره ماهانه', 'Monthly rent', 'الإيجار الشهري', re.monthlyRent ? formatMoney(re.monthlyRent, cur, lang) : undefined);
    push('ودیعه / رهن', 'Deposit', 'التأمين', re.deposit ? formatMoney(re.deposit, cur, lang) : undefined);
    push('دوره اجاره', 'Rent period', 'مدة الإيجار', T('rentPeriod'));
    push('حداقل مدت اجاره', 'Min lease', 'الحد الأدنى للإيجار', re.minLeaseMonths ? `${re.minLeaseMonths} ${L('ماه', 'months', 'شهر')}` : undefined);
  }
  if (re.dealType === 'sale' || re.dealType === 'pre-sale') {
    push('قیمت هر متر', 'Price/m²', 'السعر للمتر', re.pricePerSqm ? formatMoney(re.pricePerSqm, cur, lang) : undefined);
  }
  push('شارژ / نگهداری', 'Maintenance', 'رسوم الصيانة', re.maintenanceFee ? formatMoney(re.maintenanceFee, cur, lang) : undefined);
  push('قابل مذاکره', 'Negotiable', 'قابل للتفاوض', re.negotiable);
  push('کمیسیون', 'Commission', 'العمولة', T('commission'));

  push('استان', 'Province', 'المحافظة', T('province'));
  push('شهر', 'City', 'المدينة', T('city'));
  push('منطقه', 'District', 'المنطقة', T('district'));
  push('محله', 'Neighborhood', 'الحي', T('neighborhood'));
  push('آدرس', 'Address', 'العنوان', T('fullAddress'));
  push('تاریخ تحویل', 'Available from', 'متاح من', T('availableFrom'));
  push('مدت قرارداد', 'Lease term', 'مدة العقد', T('leaseDuration'));
  push('حیوان خانگی', 'Pets', 'الحيوانات الأليفة', T('petsAllowed'));
  push('مجوز کسب', 'Commercial license', 'رخصة تجارية', T('commercialLicense'));
  push('بر ملک (متر)', 'Frontage', 'واجهة (م)', re.frontageMeters);
  push('ارتفاع سقف', 'Ceiling height', 'ارتفاع السقف', re.ceilingHeight ? `${re.ceilingHeight} m` : undefined);
  push('برق / ظرفیت', 'Power', 'الكهرباء', T('powerCapacity'));
  push('رمپ باربری', 'Loading dock', 'رصيف التحميل', re.loadingDock);
  push('تردد', 'Foot traffic', 'حركة المشاة', T('footTraffic'));
  push('مستأجر فعلی', 'Current tenant', 'المستأجر الحالي', T('currentTenant'));
  push('بازده اجاره', 'Rental yield', 'عائد الإيجار', T('rentalYield'));
  push('وام‌پذیر', 'Loan eligible', 'مؤهل للقرض', re.loanEligible);

  const utilList = resolveReStringList(re, 'utilitiesIncluded', lang, i18n);
  if (utilList?.length) rows.push({ label: L('قبوض شامل', 'Utilities incl.', 'المرافق مشمولة'), value: utilList.join(' · ') });
  const amenities = resolveReStringList(re, 'amenities', lang, i18n);
  if (amenities?.length) rows.push({ label: L('امکانات', 'Amenities', 'المرافق'), value: amenities.join(' · ') });
  const building = resolveReStringList(re, 'buildingFeatures', lang, i18n);
  if (building?.length) rows.push({ label: L('ویژگی ساختمان', 'Building', 'ميزات المبنى'), value: building.join(' · ') });
  const nearby = resolveReStringList(re, 'nearbyPlaces', lang, i18n);
  if (nearby?.length) rows.push({ label: L('دسترسی نزدیک', 'Nearby', 'بالقرب من'), value: nearby.join(' · ') });
  const security = resolveReStringList(re, 'security', lang, i18n);
  if (security?.length) rows.push({ label: L('امنیت', 'Security', 'الأمن'), value: security.join(' · ') });
  const highlights = resolveReStringList(re, 'publicHighlights', lang, i18n);
  if (highlights?.length) rows.push({ label: L('نکات برجسته', 'Highlights', 'أبرز المزايا'), value: highlights.join(' · ') });

  return rows;
};

export const defaultRealEstate = (): MetaShopRealEstate => ({
  dealType: 'sale',
  propertyType: 'apartment',
});
