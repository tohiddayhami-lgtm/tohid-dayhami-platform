import type { MetaShop, MetaShopProduct } from '../types';
import { resolveReText } from './metaShopRealEstate';

/** Digits only — suitable for wa.me / tel:+ */
export const phoneDigits = (raw?: string): string =>
  (raw || '').replace(/[^\d]/g, '').replace(/^00/, '');

export const telHref = (raw?: string): string => {
  const d = phoneDigits(raw);
  return d ? `tel:+${d}` : '';
};

export const waHref = (raw?: string): string => {
  const d = phoneDigits(raw);
  return d ? `https://wa.me/${d}` : '';
};

export interface PropertyContact {
  agentName?: string;
  phone?: string;
  whatsapp?: string;
}

/**
 * Shop-level phone/whatsapp are defaults for every property.
 * Per-property agentPhone / agentWhatsapp override when set.
 */
export const resolvePropertyContact = (
  shop: Pick<MetaShop, 'phone' | 'whatsapp'>,
  product?: Pick<MetaShopProduct, 'realEstate' | 'i18n'>,
  lang = 'fa',
): PropertyContact => {
  const re = product?.realEstate;
  const phone = (re?.agentPhone?.trim() || shop.phone?.trim() || '') || undefined;
  const whatsappRaw =
    (re?.agentWhatsapp?.trim() || shop.whatsapp?.trim() || re?.agentPhone?.trim() || shop.phone?.trim() || '') || undefined;
  const agentName = re
    ? (resolveReText(re, 'agentName', lang, product?.i18n) || re.agentName?.trim() || undefined)
    : undefined;
  return {
    agentName,
    phone,
    whatsapp: whatsappRaw && phoneDigits(whatsappRaw) ? whatsappRaw : undefined,
  };
};

export const openTel = (raw?: string) => {
  const href = telHref(raw);
  if (href) window.location.href = href;
};

export const openWhatsApp = (raw?: string) => {
  const href = waHref(raw);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
};
