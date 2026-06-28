import { CustomerAccount, MetaShopOrder } from '../types';

export function calcCommission(total: number, percent?: number): number {
  if (!percent || percent <= 0 || total <= 0) return 0;
  return Math.round(total * percent / 100 * 100) / 100;
}

export function findPortalAccountForShop(
  accounts: CustomerAccount[],
  shopId: string,
): CustomerAccount | undefined {
  return accounts.find(a => a.isActive && a.metaShopIds?.includes(shopId));
}

export type OrderCommissionInfo = {
  percent: number;
  amount: number;
  accountName?: string;
  accountId?: string;
};

/** Stored commission on order, or computed from current account settings (legacy orders). */
export function orderPartnerCommission(
  order: MetaShopOrder,
  accounts: CustomerAccount[] = [],
): OrderCommissionInfo {
  if (order.status === 'cancelled') {
    return { percent: 0, amount: 0 };
  }
  if (order.partnerCommissionPercent != null && order.partnerCommissionAmount != null) {
    return {
      percent: order.partnerCommissionPercent,
      amount: order.partnerCommissionAmount,
      accountName: order.partnerAccountName,
      accountId: order.customerAccountId,
    };
  }
  const acc = order.customerAccountId
    ? accounts.find(a => a.id === order.customerAccountId)
    : findPortalAccountForShop(accounts, order.shopId);
  const pct = acc?.commissionPercent ?? 0;
  return {
    percent: pct,
    amount: calcCommission(order.total, pct),
    accountName: acc?.fullName,
    accountId: acc?.id,
  };
}

export function sumOrderCommissions(
  orders: MetaShopOrder[],
  accounts: CustomerAccount[] = [],
): number {
  return orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + orderPartnerCommission(o, accounts).amount, 0);
}
