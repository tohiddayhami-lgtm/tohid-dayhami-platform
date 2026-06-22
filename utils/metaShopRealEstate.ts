import type { MetaShopProduct, MetaShopRealEstate } from '../types';
import { formatInvoiceAmount } from './invoiceMoney';

export const DEAL_TYPE_LABEL: Record<string, { fa: string; en: string }> = {
  sale: { fa: 'فروش', en: 'For Sale' },
  rent: { fa: 'اجاره', en: 'For Rent' },
  'rent-short': { fa: 'اجاره کوتاه‌مدت', en: 'Short-term Rent' },
  'pre-sale': { fa: 'پیش‌فروش', en: 'Pre-sale' },
  exchange: { fa: 'معاوضه', en: 'Exchange' },
};

export const PROPERTY_TYPE_LABEL: Record<string, { fa: string; en: string }> = {
  apartment: { fa: 'آپارتمان', en: 'Apartment' },
  villa: { fa: 'ویلا', en: 'Villa' },
  penthouse: { fa: 'پنت‌هاوس', en: 'Penthouse' },
  studio: { fa: 'سوئیت / استودیو', en: 'Studio' },
  shop: { fa: 'مغازه تجاری', en: 'Retail Shop' },
  office: { fa: 'دفتر اداری', en: 'Office' },
  warehouse: { fa: 'انبار', en: 'Warehouse' },
  industrial: { fa: 'کارگاه / صنعتی', en: 'Industrial' },
  land: { fa: 'زمین', en: 'Land' },
  building: { fa: 'ساختمان', en: 'Building' },
  hotel: { fa: 'هتل / مهمان‌پذیر', en: 'Hospitality' },
};

export const propertyTypeLabel = (code: string | undefined, lang: 'fa' | 'en') => {
  if (!code) return '';
  const known = PROPERTY_TYPE_LABEL[code];
  if (known) return lang === 'fa' ? known.fa : known.en;
  return code;
};

export const dealTypeLabel = (code: string | undefined, lang: 'fa' | 'en') => {
  if (!code) return '';
  const known = DEAL_TYPE_LABEL[code];
  if (known) return lang === 'fa' ? known.fa : known.en;
  return code;
};

export const formatMoney = (n: number | undefined, currency: string, lang: 'fa' | 'en') => {
  if (n == null || !n) return '';
  return `${formatInvoiceAmount(n, 0)} ${currency}`;
};

/** خلاصه برای کارت لیست */
export const realEstateCardSummary = (p: MetaShopProduct, lang: 'fa' | 'en'): string[] => {
  const re = p.realEstate;
  if (!re) return [];
  const lines: string[] = [];
  const T = lang === 'fa';
  if (re.areaSqm) lines.push(T ? `${re.areaSqm} متر` : `${re.areaSqm} m²`);
  if (re.bedrooms != null) lines.push(T ? `${re.bedrooms} خواب` : `${re.bedrooms} bed`);
  if (re.bathrooms != null) lines.push(T ? `${re.bathrooms} حمام` : `${re.bathrooms} bath`);
  if (re.floor != null) lines.push(T ? `طبقه ${re.floor}` : `Floor ${re.floor}`);
  if (re.district || re.city) lines.push([re.district, re.city].filter(Boolean).join(' · '));
  return lines;
};

/** ردیف‌های مشخصات برای مودال جزئیات */
export const realEstateDetailRows = (p: MetaShopProduct, lang: 'fa' | 'en'): { label: string; value: string }[] => {
  const re = p.realEstate;
  if (!re) return [];
  const T = lang === 'fa';
  const L = (fa: string, en: string) => (T ? fa : en);
  const cur = re.rentCurrency || p.currency || 'IRR';
  const rows: { label: string; value: string }[] = [];

  const push = (fa: string, en: string, val: string | number | boolean | undefined | null) => {
    if (val === undefined || val === null || val === '') return;
    if (typeof val === 'boolean') rows.push({ label: L(fa, en), value: val ? L('بله', 'Yes') : L('خیر', 'No') });
    else rows.push({ label: L(fa, en), value: String(val) });
  };

  push('نوع معامله', 'Deal', dealTypeLabel(re.dealType, lang));
  push('نوع ملک', 'Property', propertyTypeLabel(re.propertyType, lang) || re.propertyType);
  push('کاربری', 'Usage', re.usage);
  push('متراژ بنا', 'Built area', re.areaSqm ? `${re.areaSqm} m²` : undefined);
  push('متراژ زمین', 'Land area', re.landAreaSqm ? `${re.landAreaSqm} m²` : undefined);
  push('اتاق خواب', 'Bedrooms', re.bedrooms);
  push('حمام', 'Bathrooms', re.bathrooms);
  push('طبقه', 'Floor', re.floor != null ? `${re.floor} / ${re.totalFloors ?? '?'}` : undefined);
  push('سال ساخت', 'Year built', re.yearBuilt);
  push('نوساز / بازسازی', 'Renovation', re.renovatedYear || re.renovation);
  push('جهت', 'Facing', re.facing);
  push('نما', 'View', re.view);
  push('نوع سند', 'Title deed', re.documentType);
  push('مالکیت', 'Ownership', re.ownership);
  push('وضعیت سکونت', 'Occupancy', re.occupancyStatus);
  push('مبله', 'Furnished', re.furnished);
  push('پارکینگ', 'Parking', re.parkingSpaces != null ? `${re.parkingSpaces} (${re.parkingType || ''})` : undefined);
  push('انباری', 'Storage', re.storage);
  push('بالکن', 'Balcony', re.balcony);
  push('آسانسور', 'Elevator', re.elevator);
  push('آسانسور بار', 'Freight elevator', re.freightElevator);
  push('گرمایش', 'Heating', re.heating);
  push('سرمایش', 'Cooling', re.cooling);
  push('کف', 'Flooring', re.flooring);
  push('آشپزخانه', 'Kitchen', re.kitchen);

  if (re.dealType === 'rent' || re.dealType === 'rent-short') {
    push('اجاره ماهانه', 'Monthly rent', re.monthlyRent ? formatMoney(re.monthlyRent, cur, lang) : undefined);
    push('ودیعه / رهن', 'Deposit', re.deposit ? formatMoney(re.deposit, cur, lang) : undefined);
    push('دوره اجاره', 'Rent period', re.rentPeriod);
    push('حداقل مدت اجاره', 'Min lease', re.minLeaseMonths ? `${re.minLeaseMonths} ${L('ماه', 'months')}` : undefined);
  }
  if (re.dealType === 'sale' || re.dealType === 'pre-sale') {
    push('قیمت هر متر', 'Price/m²', re.pricePerSqm ? formatMoney(re.pricePerSqm, cur, lang) : undefined);
  }
  push('شارژ / نگهداری', 'Maintenance', re.maintenanceFee ? formatMoney(re.maintenanceFee, cur, lang) : undefined);
  push('قابل مذاکره', 'Negotiable', re.negotiable);
  push('کمیسیون', 'Commission', re.commission);

  push('استان', 'Province', re.province);
  push('شهر', 'City', re.city);
  push('منطقه', 'District', re.district);
  push('محله', 'Neighborhood', re.neighborhood);
  push('آدرس', 'Address', re.fullAddress);
  push('تاریخ تحویل', 'Available from', re.availableFrom);
  push('مدت قرارداد', 'Lease term', re.leaseDuration);
  push('حیوان خانگی', 'Pets', re.petsAllowed);
  push('مجوز کسب', 'Commercial license', re.commercialLicense);
  push('بر ملک (متر)', 'Frontage', re.frontageMeters);
  push('ارتفاع سقف', 'Ceiling height', re.ceilingHeight ? `${re.ceilingHeight} m` : undefined);
  push('برق / ظرفیت', 'Power', re.powerCapacity);
  push('رمپ باربری', 'Loading dock', re.loadingDock);
  push('تردد', 'Foot traffic', re.footTraffic);
  push('مستأجر فعلی', 'Current tenant', re.currentTenant);
  push('بازده اجاره', 'Rental yield', re.rentalYield);
  push('وام‌پذیر', 'Loan eligible', re.loanEligible);

  if (re.utilitiesIncluded?.length) rows.push({ label: L('قبوض شامل', 'Utilities incl.'), value: re.utilitiesIncluded.join(' · ') });
  if (re.amenities?.length) rows.push({ label: L('امکانات', 'Amenities'), value: re.amenities.join(' · ') });
  if (re.buildingFeatures?.length) rows.push({ label: L('ویژگی ساختمان', 'Building'), value: re.buildingFeatures.join(' · ') });
  if (re.nearbyPlaces?.length) rows.push({ label: L('دسترسی نزدیک', 'Nearby'), value: re.nearbyPlaces.join(' · ') });
  if (re.security?.length) rows.push({ label: L('امنیت', 'Security'), value: re.security.join(' · ') });
  if (re.publicHighlights?.length) rows.push({ label: L('نکات برجسته', 'Highlights'), value: re.publicHighlights.join(' · ') });

  return rows;
};

export const defaultRealEstate = (): MetaShopRealEstate => ({
  dealType: 'sale',
  propertyType: 'apartment',
});
