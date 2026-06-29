import { MetaShop, MetaShopOrder, MetaShopType } from '../types';

export type OrderPeriod = 'all' | '7d' | '30d' | '90d';

export type OrderHubFilters = {
  shopId?: string;
  status?: MetaShopOrder['status'] | '';
  period?: OrderPeriod;
  query?: string;
};

export type RevenueByCurrency = Record<string, number>;

export type ShopOrderStats = {
  shopId: string;
  shopName: string;
  shopType?: MetaShopType;
  orderCount: number;
  newCount: number;
  inProgressCount: number;
  doneCount: number;
  cancelledCount: number;
  revenueByCurrency: RevenueByCurrency;
};

export type ProductOrderStats = {
  key: string;
  productId: string;
  name: string;
  shopId: string;
  shopName: string;
  qtySold: number;
  orderCount: number;
  revenueByCurrency: RevenueByCurrency;
};

export type OrderHubSummary = {
  totalOrders: number;
  newCount: number;
  inProgressCount: number;
  doneCount: number;
  cancelledCount: number;
  revenueByCurrency: RevenueByCurrency;
  commissionByCurrency: RevenueByCurrency;
};

function isCountableRevenue(order: MetaShopOrder): boolean {
  return order.status !== 'cancelled' && order.total > 0;
}

function periodStart(period: OrderPeriod): Date | null {
  if (period === 'all') return null;
  const d = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filterMetaShopOrders(
  orders: MetaShopOrder[],
  filters: OrderHubFilters,
): MetaShopOrder[] {
  const q = (filters.query || '').trim().toLowerCase();
  const from = periodStart(filters.period || 'all');

  return orders.filter(o => {
    if (filters.shopId && o.shopId !== filters.shopId) return false;
    if (filters.status && o.status !== filters.status) return false;
    if (from && new Date(o.createdAt).getTime() < from.getTime()) return false;
    if (!q) return true;
    const hay = [
      o.customerName,
      o.company,
      o.phone,
      o.email,
      o.trackingCode,
      o.shopName,
      o.notes,
      ...o.items.map(it => [it.name, it.sku, it.productId].join(' ')),
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function summarizeOrders(orders: MetaShopOrder[]): OrderHubSummary {
  const revenueByCurrency: RevenueByCurrency = {};
  const commissionByCurrency: RevenueByCurrency = {};
  let newCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;
  let cancelledCount = 0;

  for (const o of orders) {
    if (o.status === 'new') newCount++;
    else if (o.status === 'in_progress') inProgressCount++;
    else if (o.status === 'done') doneCount++;
    else if (o.status === 'cancelled') cancelledCount++;

    if (isCountableRevenue(o)) {
      revenueByCurrency[o.currency] = (revenueByCurrency[o.currency] || 0) + o.total;
    }
    if (o.status !== 'cancelled' && (o.partnerCommissionAmount ?? 0) > 0) {
      commissionByCurrency[o.currency] = (commissionByCurrency[o.currency] || 0) + (o.partnerCommissionAmount ?? 0);
    }
  }

  return {
    totalOrders: orders.length,
    newCount,
    inProgressCount,
    doneCount,
    cancelledCount,
    revenueByCurrency,
    commissionByCurrency,
  };
}

export function aggregateShopStats(
  orders: MetaShopOrder[],
  shops: MetaShop[],
): ShopOrderStats[] {
  const shopMap = new Map(shops.map(s => [s.id, s]));
  const byShop = new Map<string, ShopOrderStats>();

  const ensure = (o: MetaShopOrder): ShopOrderStats => {
    let row = byShop.get(o.shopId);
    if (!row) {
      const shop = shopMap.get(o.shopId);
      row = {
        shopId: o.shopId,
        shopName: shop?.name || o.shopName,
        shopType: shop?.type || o.shopType,
        orderCount: 0,
        newCount: 0,
        inProgressCount: 0,
        doneCount: 0,
        cancelledCount: 0,
        revenueByCurrency: {},
      };
      byShop.set(o.shopId, row);
    }
    return row;
  };

  for (const o of orders) {
    const row = ensure(o);
    row.orderCount++;
    if (o.status === 'new') row.newCount++;
    else if (o.status === 'in_progress') row.inProgressCount++;
    else if (o.status === 'done') row.doneCount++;
    else if (o.status === 'cancelled') row.cancelledCount++;
    if (isCountableRevenue(o)) {
      row.revenueByCurrency[o.currency] = (row.revenueByCurrency[o.currency] || 0) + o.total;
    }
  }

  return [...byShop.values()].sort((a, b) => {
    const revA = Object.values(a.revenueByCurrency).reduce((s, n) => s + n, 0);
    const revB = Object.values(b.revenueByCurrency).reduce((s, n) => s + n, 0);
    if (revB !== revA) return revB - revA;
    return b.orderCount - a.orderCount;
  });
}

export function aggregateProductStats(orders: MetaShopOrder[]): ProductOrderStats[] {
  const map = new Map<string, ProductOrderStats>();

  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items) {
      const key = `${o.shopId}::${it.productId}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          productId: it.productId,
          name: it.name,
          shopId: o.shopId,
          shopName: o.shopName,
          qtySold: 0,
          orderCount: 0,
          revenueByCurrency: {},
        };
        map.set(key, row);
      }
      row.qtySold += it.qty || 1;
      row.orderCount++;
      if (!it.priceHidden && (it.lineTotal ?? 0) > 0) {
        const cur = it.currency || o.currency;
        row.revenueByCurrency[cur] = (row.revenueByCurrency[cur] || 0) + (it.lineTotal ?? 0);
      }
    }
  }

  return [...map.values()].sort((a, b) => b.qtySold - a.qtySold);
}

export function formatRevenueLines(revenue: RevenueByCurrency): string {
  const entries = Object.entries(revenue).filter(([, v]) => v > 0);
  if (!entries.length) return '—';
  return entries.map(([cur, amt]) => `${cur} ${amt.toLocaleString()}`).join(' · ');
}

export function exportOrdersToCsv(
  orders: MetaShopOrder[],
  lang: 'fa' | 'en',
): string {
  const fa = lang === 'fa';
  const headers = fa
    ? ['تاریخ', 'فروشگاه', 'کد پیگیری', 'مشتری', 'شرکت', 'تلفن', 'ایمیل', 'وضعیت', 'مبلغ', 'ارز', 'اقلام', 'یادداشت']
    : ['Date', 'Shop', 'Tracking', 'Customer', 'Company', 'Phone', 'Email', 'Status', 'Total', 'Currency', 'Items', 'Notes'];

  const statusLabel = (s: MetaShopOrder['status']) =>
    s === 'new' ? (fa ? 'جدید' : 'New')
      : s === 'in_progress' ? (fa ? 'در حال انجام' : 'In progress')
      : s === 'done' ? (fa ? 'انجام شد' : 'Done')
      : fa ? 'لغو' : 'Cancelled';

  const esc = (v: string | number | undefined) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(o => [
      new Date(o.createdAt).toISOString(),
      o.shopName,
      o.trackingCode,
      o.customerName,
      o.company || '',
      o.phone,
      o.email || '',
      statusLabel(o.status),
      o.total,
      o.currency,
      o.items.map(it => `${it.name} ×${it.qty}`).join(' | '),
      o.notes || '',
    ].map(esc).join(','));

  return [headers.join(','), ...rows].join('\n');
}

export function downloadOrdersCsv(orders: MetaShopOrder[], lang: 'fa' | 'en', filename = 'metashop-orders.csv') {
  const csv = '\uFEFF' + exportOrdersToCsv(orders, lang);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
