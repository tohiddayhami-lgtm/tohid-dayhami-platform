import React, { useMemo, useState } from 'react';
import { CustomerAccount, MetaShop, MetaShopOrder } from '../types';
import { Language } from '../App';
import { MetaShopOrderDetailCard } from './MetaShopOrderDetailCard';
import { IconSearch, IconDownload } from './Icons';
import {
  aggregateProductStats,
  aggregateShopStats,
  downloadOrdersCsv,
  filterMetaShopOrders,
  formatRevenueLines,
  OrderHubFilters,
  OrderPeriod,
  summarizeOrders,
} from '../utils/metaShopOrderAnalytics';

interface Props {
  metaShops: MetaShop[];
  orders: MetaShopOrder[];
  customerAccounts?: CustomerAccount[];
  shopBaseUrl: string;
  lang: Language;
  readonly?: boolean;
  onUpdateOrder: (id: string, updates: Partial<MetaShopOrder>) => Promise<void>;
  onDeleteOrder?: (id: string) => Promise<void>;
  onBack: () => void;
  sectionToggle?: React.ReactNode;
}

type HubTab = 'report' | 'orders';

const STATUS_OPTIONS: { value: MetaShopOrder['status'] | ''; labelFa: string; labelEn: string }[] = [
  { value: '', labelFa: 'همه وضعیت‌ها', labelEn: 'All statuses' },
  { value: 'new', labelFa: 'جدید', labelEn: 'New' },
  { value: 'in_progress', labelFa: 'در حال انجام', labelEn: 'In progress' },
  { value: 'done', labelFa: 'انجام شد', labelEn: 'Done' },
  { value: 'cancelled', labelFa: 'لغو شده', labelEn: 'Cancelled' },
];

const PERIOD_OPTIONS: { value: OrderPeriod; labelFa: string; labelEn: string }[] = [
  { value: 'all', labelFa: 'همه زمان‌ها', labelEn: 'All time' },
  { value: '7d', labelFa: '۷ روز اخیر', labelEn: 'Last 7 days' },
  { value: '30d', labelFa: '۳۰ روز اخیر', labelEn: 'Last 30 days' },
  { value: '90d', labelFa: '۹۰ روز اخیر', labelEn: 'Last 90 days' },
];

export const MetaShopOrdersHub: React.FC<Props> = ({
  metaShops, orders, customerAccounts = [], shopBaseUrl, lang, readonly,
  onUpdateOrder, onDeleteOrder, onBack, sectionToggle,
}) => {
  const T = lang === 'fa';
  const [tab, setTab] = useState<HubTab>('report');
  const [shopId, setShopId] = useState('');
  const [status, setStatus] = useState<MetaShopOrder['status'] | ''>('');
  const [period, setPeriod] = useState<OrderPeriod>('all');
  const [query, setQuery] = useState('');

  const filters: OrderHubFilters = useMemo(
    () => ({ shopId: shopId || undefined, status, period, query }),
    [shopId, status, period, query],
  );

  const filtered = useMemo(() => filterMetaShopOrders(orders, filters), [orders, filters]);
  const summary = useMemo(() => summarizeOrders(filtered), [filtered]);
  const shopStats = useMemo(() => aggregateShopStats(filtered, metaShops), [filtered, metaShops]);
  const productStats = useMemo(() => aggregateProductStats(filtered).slice(0, 15), [filtered]);
  const shopById = useMemo(() => new Map(metaShops.map(s => [s.id, s])), [metaShops]);

  const sortedOrders = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  );

  const confirmDeleteOrder = (orderId: string) => {
    if (!onDeleteOrder) return;
    const msg = T
      ? 'این سفارش برای همیشه حذف شود؟'
      : 'Permanently delete this order?';
    if (window.confirm(msg)) void onDeleteOrder(orderId);
  };

  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5';
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  const statusMax = Math.max(summary.newCount, summary.inProgressCount, summary.doneCount, summary.cancelledCount, 1);

  return (
    <div className="space-y-5 animate-fade-in">
      {sectionToggle}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 mb-2">
            ← {T ? 'بازگشت به فروشگاه‌ها' : 'Back to shops'}
          </button>
          <h3 className="text-lg font-bold text-gray-800">
            {T ? 'مرکز مدیریت سفارش‌ها' : 'Orders command center'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {T
              ? 'نمای متمرکز همه سفارش‌های MetaShop — مشتری، محصول، فروشگاه و گزارش فروش'
              : 'Central view of all MetaShop orders — customer, products, shop & sales reports'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => downloadOrdersCsv(filtered, lang)}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-40"
          >
            <IconDownload className="w-4 h-4" />
            {T ? 'خروجی CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: T ? 'کل سفارش‌ها' : 'Total orders', value: summary.totalOrders, cls: 'text-gray-900' },
          { label: T ? 'جدید' : 'New', value: summary.newCount, cls: 'text-amber-700' },
          { label: T ? 'در حال انجام' : 'In progress', value: summary.inProgressCount, cls: 'text-blue-700' },
          { label: T ? 'انجام‌شده' : 'Done', value: summary.doneCount, cls: 'text-emerald-700' },
          { label: T ? 'لغو شده' : 'Cancelled', value: summary.cancelledCount, cls: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className={card + ' text-center'}>
            <div className={`text-2xl font-bold ${k.cls}`}>{k.value}</div>
            <div className="text-[11px] text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
        <div className={card + ' col-span-2 md:col-span-1 lg:col-span-1'}>
          <div className="text-[11px] text-gray-500 mb-1">{T ? 'درآمد (بدون لغو)' : 'Revenue (excl. cancelled)'}</div>
          <div className="text-sm font-bold text-indigo-800 leading-snug">
            {formatRevenueLines(summary.revenueByCurrency)}
          </div>
          {Object.keys(summary.commissionByCurrency).length > 0 && (
            <div className="text-[10px] text-violet-600 mt-1">
              {T ? 'کمیسیون' : 'Commission'}: {formatRevenueLines(summary.commissionByCurrency)}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={card + ' space-y-3'}>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {T ? 'فیلتر و جستجو' : 'Filter & search'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select className={fld} value={shopId} onChange={e => setShopId(e.target.value)}>
            <option value="">{T ? 'همه فروشگاه‌ها' : 'All shops'}</option>
            {metaShops.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select className={fld} value={status} onChange={e => setStatus(e.target.value as MetaShopOrder['status'] | '')}>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value || 'all'} value={o.value}>{T ? o.labelFa : o.labelEn}</option>
            ))}
          </select>
          <select className={fld} value={period} onChange={e => setPeriod(e.target.value as OrderPeriod)}>
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{T ? o.labelFa : o.labelEn}</option>
            ))}
          </select>
          <div className="relative">
            <IconSearch className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="search"
              className={fld + ' ps-9'}
              placeholder={T ? 'نام، تلفن، کد پیگیری، محصول...' : 'Name, phone, tracking, product...'}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {filtered.length} {T ? 'سفارش مطابق فیلتر' : 'orders match filters'}
          {summary.newCount > 0 && (
            <span className="text-amber-700 font-medium ms-2">
              · {summary.newCount} {T ? 'در انتظار رسیدگی' : 'awaiting action'}
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('report')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'report' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          {T ? '📊 گزارش فروش' : '📊 Sales report'}
        </button>
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === 'orders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          {T ? '📋 لیست سفارش‌ها' : '📋 Order list'}
          {summary.newCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{summary.newCount}</span>
          )}
        </button>
      </div>

      {tab === 'report' && (
        <div className="space-y-5">
          {/* Status breakdown */}
          <div className={card}>
            <h4 className="text-sm font-bold text-gray-800 mb-4">{T ? 'توزیع وضعیت سفارش‌ها' : 'Order status breakdown'}</h4>
            <div className="space-y-3">
              {[
                { key: 'new', label: T ? 'جدید' : 'New', count: summary.newCount, color: 'bg-amber-500' },
                { key: 'prog', label: T ? 'در حال انجام' : 'In progress', count: summary.inProgressCount, color: 'bg-blue-500' },
                { key: 'done', label: T ? 'انجام شد' : 'Done', count: summary.doneCount, color: 'bg-emerald-500' },
                { key: 'canc', label: T ? 'لغو' : 'Cancelled', count: summary.cancelledCount, color: 'bg-red-400' },
              ].map(row => (
                <div key={row.key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-24 shrink-0">{row.label}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${(row.count / statusMax) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-gray-500 w-8 text-end">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shop leaderboard */}
          <div className={card + ' overflow-hidden p-0'}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="text-sm font-bold text-gray-800">{T ? 'رتبه‌بندی فروشگاه‌ها' : 'Shop leaderboard'}</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">{T ? 'بر اساس تعداد سفارش و درآمد' : 'By order count and revenue'}</p>
            </div>
            {shopStats.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">{T ? 'داده‌ای نیست' : 'No data'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                      <th className="text-start px-4 py-2.5 font-semibold">#</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'فروشگاه' : 'Shop'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'سفارش' : 'Orders'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'جدید' : 'New'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'انجام‌شده' : 'Done'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'درآمد' : 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {shopStats.map((row, i) => (
                      <tr key={row.shopId} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => { setShopId(row.shopId); setTab('orders'); }}
                            className="font-medium text-indigo-700 hover:underline text-start"
                          >
                            {row.shopName}
                          </button>
                          {row.shopType && (
                            <span className="block text-[10px] text-gray-400">{row.shopType}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">{row.orderCount}</td>
                        <td className="px-4 py-3">
                          {row.newCount > 0 ? (
                            <span className="text-amber-700 font-medium">{row.newCount}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-emerald-700">{row.doneCount}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-800">
                          {formatRevenueLines(row.revenueByCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top products */}
          <div className={card + ' overflow-hidden p-0'}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="text-sm font-bold text-gray-800">{T ? 'پرفروش‌ترین محصولات' : 'Top products'}</h4>
            </div>
            {productStats.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">{T ? 'داده‌ای نیست' : 'No data'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                      <th className="text-start px-4 py-2.5 font-semibold">#</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'محصول' : 'Product'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'فروشگاه' : 'Shop'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'تعداد' : 'Qty'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'سفارش' : 'Orders'}</th>
                      <th className="text-start px-4 py-2.5 font-semibold">{T ? 'درآمد خط' : 'Line revenue'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {productStats.map((row, i) => (
                      <tr key={row.key} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate" title={row.name}>{row.name}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{row.shopName}</td>
                        <td className="px-4 py-3 font-semibold">{row.qtySold}</td>
                        <td className="px-4 py-3">{row.orderCount}</td>
                        <td className="px-4 py-3 text-xs">{formatRevenueLines(row.revenueByCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          {sortedOrders.length === 0 ? (
            <div className={card + ' text-center py-12 text-gray-400 text-sm'}>
              {T ? 'سفارشی با این فیلتر یافت نشد.' : 'No orders match these filters.'}
            </div>
          ) : sortedOrders.map(o => (
            <MetaShopOrderDetailCard
              key={o.id}
              order={o}
              shop={shopById.get(o.shopId)}
              shopBaseUrl={shopBaseUrl}
              lang={lang}
              showShopName
              customerAccounts={customerAccounts}
              commissionView="master"
              onStatusChange={status => onUpdateOrder(o.id, { status })}
              onDelete={!readonly && onDeleteOrder ? () => confirmDeleteOrder(o.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};
