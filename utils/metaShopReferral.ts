import type { MetaShop, MetaShopProduct, MetaShopPropertyReferral } from '../types';

export const generateReferralTrackingCode = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${digits.slice(-4) || '0000'}-${rand}`;
};

/** Convert an approved referral into a draft listing (inactive until master publishes). */
export const referralToProduct = (
  ref: MetaShopPropertyReferral,
  shop: MetaShop,
  productId?: string,
): MetaShopProduct => {
  const isRent = ref.dealType === 'rent' || ref.dealType === 'rent-short';
  const title = ref.propertyTitle?.trim()
    || [ref.city, ref.district].filter(Boolean).join(' — ')
    || 'ملک معرفی‌شده';
  const id = productId || `p-${Date.now()}`;
  const code = ref.trackingCode.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  return {
    id,
    name: title,
    sku: `REF-${code}`,
    group: isRent ? 'اجاره' : 'فروش',
    description: ref.description?.trim() || ref.notes?.trim() || '',
    images: ref.images?.length ? [...ref.images] : [],
    active: false,
    hidePrice: !ref.price && !ref.monthlyRent,
    currency: ref.currency || shop.currency,
    price: !isRent ? ref.price : undefined,
    realEstate: {
      dealType: ref.dealType || 'sale',
      propertyType: ref.propertyType || 'apartment',
      city: ref.city,
      district: ref.district,
      areaSqm: ref.areaSqm,
      bedrooms: ref.bedrooms,
      bathrooms: ref.bathrooms,
      monthlyRent: isRent ? ref.monthlyRent : undefined,
      deposit: isRent ? ref.deposit : undefined,
      rentCurrency: ref.currency || shop.currency,
    },
  };
};
