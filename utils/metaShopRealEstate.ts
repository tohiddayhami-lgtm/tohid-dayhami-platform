import type { MetaShopLang, MetaShopProduct, MetaShopRealEstate, MetaShopRealEstateFaq } from '../types';
import { formatInvoiceAmount } from './invoiceMoney';

export type MetaShopDisplayLang = 'fa' | 'en' | 'ar';

export const REAL_ESTATE_DEFAULT_LANGS: MetaShopLang[] = [
  { code: 'fa', name: 'فارسی', rtl: true },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'en', name: 'English' },
];

export const resolveDisplayLang = (code: string): MetaShopDisplayLang => {
  if (code === 'fa') return 'fa';
  if (code === 'ar') return 'ar';
  return 'en';
};

type Tri = { fa: string; en: string; ar: string };

const pick = (t: Tri, lang: MetaShopDisplayLang) => {
  if (lang === 'fa') return t.fa;
  if (lang === 'ar') return t.ar;
  return t.en;
};

const L3 = (fa: string, en: string, ar: string, lang: MetaShopDisplayLang) => pick({ fa, en, ar }, lang);

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

export const propertyTypeLabel = (code: string | undefined, lang: MetaShopDisplayLang) => {
  if (!code) return '';
  const known = PROPERTY_TYPE_LABEL[code];
  if (known) return pick(known, lang);
  return code;
};

export const dealTypeLabel = (code: string | undefined, lang: MetaShopDisplayLang) => {
  if (!code) return '';
  const known = DEAL_TYPE_LABEL[code];
  if (known) return pick(known, lang);
  return code;
};

export const formatMoney = (n: number | undefined, currency: string, _lang: MetaShopDisplayLang) => {
  if (n == null || !n) return '';
  return `${formatInvoiceAmount(n, 0)} ${currency}`;
};

export const realEstateFaqText = (f: MetaShopRealEstateFaq, part: 'q' | 'a', lang: MetaShopDisplayLang): string => {
  if (lang === 'fa') return part === 'q' ? f.q : f.a;
  if (lang === 'ar') {
    if (part === 'q') return f.qAr || f.qEn || f.q;
    return f.aAr || f.aEn || f.a;
  }
  if (part === 'q') return f.qEn || f.q;
  return f.aEn || f.a;
};

/** خلاصه برای کارت لیست */
export const realEstateCardSummary = (p: MetaShopProduct, lang: MetaShopDisplayLang): string[] => {
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
  if (re.district || re.city) lines.push([re.district, re.city].filter(Boolean).join(' · '));
  return lines;
};

/** ردیف‌های مشخصات برای مودال جزئیات */
export const realEstateDetailRows = (p: MetaShopProduct, lang: MetaShopDisplayLang): { label: string; value: string }[] => {
  const re = p.realEstate;
  if (!re) return [];
  const L = (fa: string, en: string, ar: string) => L3(fa, en, ar, lang);
  const cur = re.rentCurrency || p.currency || 'IRR';
  const rows: { label: string; value: string }[] = [];

  const push = (fa: string, en: string, ar: string, val: string | number | boolean | undefined | null) => {
    if (val === undefined || val === null || val === '') return;
    if (typeof val === 'boolean') rows.push({ label: L(fa, en, ar), value: val ? L('بله', 'Yes', 'نعم') : L('خیر', 'No', 'لا') });
    else rows.push({ label: L(fa, en, ar), value: String(val) });
  };

  push('نوع معامله', 'Deal', 'نوع الصفقة', dealTypeLabel(re.dealType, lang));
  push('نوع ملک', 'Property', 'نوع العقار', propertyTypeLabel(re.propertyType, lang) || re.propertyType);
  push('کاربری', 'Usage', 'الاستخدام', re.usage);
  push('متراژ بنا', 'Built area', 'مساحة البناء', re.areaSqm ? `${re.areaSqm} m²` : undefined);
  push('متراژ زمین', 'Land area', 'مساحة الأرض', re.landAreaSqm ? `${re.landAreaSqm} m²` : undefined);
  push('اتاق خواب', 'Bedrooms', 'غرف النوم', re.bedrooms);
  push('حمام', 'Bathrooms', 'الحمامات', re.bathrooms);
  push('طبقه', 'Floor', 'الطابق', re.floor != null ? `${re.floor} / ${re.totalFloors ?? '?'}` : undefined);
  push('سال ساخت', 'Year built', 'سنة البناء', re.yearBuilt);
  push('نوساز / بازسازی', 'Renovation', 'التجديد', re.renovatedYear || re.renovation);
  push('جهت', 'Facing', 'الاتجاه', re.facing);
  push('نما', 'View', 'الإطلالة', re.view);
  push('نوع سند', 'Title deed', 'نوع السند', re.documentType);
  push('مالکیت', 'Ownership', 'الملكية', re.ownership);
  push('وضعیت سکونت', 'Occupancy', 'حالة الإشغال', re.occupancyStatus);
  push('مبله', 'Furnished', 'مفروش', re.furnished);
  push('پارکینگ', 'Parking', 'موقف سيارات', re.parkingSpaces != null ? `${re.parkingSpaces} (${re.parkingType || ''})` : undefined);
  push('انباری', 'Storage', 'مخزن', re.storage);
  push('بالکن', 'Balcony', 'شرفة', re.balcony);
  push('آسانسور', 'Elevator', 'مصعد', re.elevator);
  push('آسانسور بار', 'Freight elevator', 'مصعد بضائع', re.freightElevator);
  push('گرمایش', 'Heating', 'تدفئة', re.heating);
  push('سرمایش', 'Cooling', 'تبريد', re.cooling);
  push('کف', 'Flooring', 'الأرضيات', re.flooring);
  push('آشپزخانه', 'Kitchen', 'المطبخ', re.kitchen);

  if (re.dealType === 'rent' || re.dealType === 'rent-short') {
    push('اجاره ماهانه', 'Monthly rent', 'الإيجار الشهري', re.monthlyRent ? formatMoney(re.monthlyRent, cur, lang) : undefined);
    push('ودیعه / رهن', 'Deposit', 'التأمين', re.deposit ? formatMoney(re.deposit, cur, lang) : undefined);
    push('دوره اجاره', 'Rent period', 'مدة الإيجار', re.rentPeriod);
    push('حداقل مدت اجاره', 'Min lease', 'الحد الأدنى للإيجار', re.minLeaseMonths ? `${re.minLeaseMonths} ${L('ماه', 'months', 'شهر')}` : undefined);
  }
  if (re.dealType === 'sale' || re.dealType === 'pre-sale') {
    push('قیمت هر متر', 'Price/m²', 'السعر للمتر', re.pricePerSqm ? formatMoney(re.pricePerSqm, cur, lang) : undefined);
  }
  push('شارژ / نگهداری', 'Maintenance', 'رسوم الصيانة', re.maintenanceFee ? formatMoney(re.maintenanceFee, cur, lang) : undefined);
  push('قابل مذاکره', 'Negotiable', 'قابل للتفاوض', re.negotiable);
  push('کمیسیون', 'Commission', 'العمولة', re.commission);

  push('استان', 'Province', 'المحافظة', re.province);
  push('شهر', 'City', 'المدينة', re.city);
  push('منطقه', 'District', 'المنطقة', re.district);
  push('محله', 'Neighborhood', 'الحي', re.neighborhood);
  push('آدرس', 'Address', 'العنوان', re.fullAddress);
  push('تاریخ تحویل', 'Available from', 'متاح من', re.availableFrom);
  push('مدت قرارداد', 'Lease term', 'مدة العقد', re.leaseDuration);
  push('حیوان خانگی', 'Pets', 'الحيوانات الأليفة', re.petsAllowed);
  push('مجوز کسب', 'Commercial license', 'رخصة تجارية', re.commercialLicense);
  push('بر ملک (متر)', 'Frontage', 'واجهة (م)', re.frontageMeters);
  push('ارتفاع سقف', 'Ceiling height', 'ارتفاع السقف', re.ceilingHeight ? `${re.ceilingHeight} m` : undefined);
  push('برق / ظرفیت', 'Power', 'الكهرباء', re.powerCapacity);
  push('رمپ باربری', 'Loading dock', 'رصيف التحميل', re.loadingDock);
  push('تردد', 'Foot traffic', 'حركة المشاة', re.footTraffic);
  push('مستأجر فعلی', 'Current tenant', 'المستأجر الحالي', re.currentTenant);
  push('بازده اجاره', 'Rental yield', 'عائد الإيجار', re.rentalYield);
  push('وام‌پذیر', 'Loan eligible', 'مؤهل للقرض', re.loanEligible);

  if (re.utilitiesIncluded?.length) rows.push({ label: L('قبوض شامل', 'Utilities incl.', 'المرافق مشمولة'), value: re.utilitiesIncluded.join(' · ') });
  if (re.amenities?.length) rows.push({ label: L('امکانات', 'Amenities', 'المرافق'), value: re.amenities.join(' · ') });
  if (re.buildingFeatures?.length) rows.push({ label: L('ویژگی ساختمان', 'Building', 'ميزات المبنى'), value: re.buildingFeatures.join(' · ') });
  if (re.nearbyPlaces?.length) rows.push({ label: L('دسترسی نزدیک', 'Nearby', 'بالقرب من'), value: re.nearbyPlaces.join(' · ') });
  if (re.security?.length) rows.push({ label: L('امنیت', 'Security', 'الأمن'), value: re.security.join(' · ') });
  if (re.publicHighlights?.length) rows.push({ label: L('نکات برجسته', 'Highlights', 'أبرز المزايا'), value: re.publicHighlights.join(' · ') });

  return rows;
};

export const defaultRealEstate = (): MetaShopRealEstate => ({
  dealType: 'sale',
  propertyType: 'apartment',
});
