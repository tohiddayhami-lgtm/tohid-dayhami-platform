import type { MetaShop, MetaShopMember } from '../types';

/** Effective VIP discount percent for checkout (0 if not VIP). */
export function resolveMemberVipDiscountPercent(
  shop: Pick<MetaShop, 'vipDefaultDiscountPercent'>,
  member: Pick<MetaShopMember, 'isVip' | 'vipDiscountPercent'> | null | undefined,
): number {
  if (!member?.isVip) return 0;
  const personal = member.vipDiscountPercent;
  if (personal != null && personal > 0) return Math.min(100, personal);
  const shopDefault = shop.vipDefaultDiscountPercent ?? 0;
  return Math.min(100, Math.max(0, shopDefault));
}

export function computeVipDiscountAmount(subtotal: number, percent: number): number {
  if (percent <= 0 || subtotal <= 0) return 0;
  return Math.round(subtotal * percent / 100 * 100) / 100;
}
