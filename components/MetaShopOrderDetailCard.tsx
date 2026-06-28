import React from 'react';
import { CustomerAccount, MetaShop, MetaShopOrder } from '../types';
import { Language } from '../App';
import { orderPartnerCommission } from '../utils/metaShopCommission';

interface Props {
  order: MetaShopOrder;
  shop?: MetaShop | null;
  shopBaseUrl: string;
  lang: Language;
  onStatusChange?: (status: MetaShopOrder['status']) => void;
  showShopName?: boolean;
  customerAccounts?: CustomerAccount[];
  /** When true, show commission as revenue for master; when false, show as amount partner owes. */
  commissionView?: 'master' | 'partner';
  partnerCommissionPercent?: number;
}

const statusCls = (s: MetaShopOrder['status']) =>
  s === 'done' ? 'bg-emerald-100 text-emerald-700'
    : s === 'in_progress' ? 'bg-blue-100 text-blue-700'
    : s === 'cancelled' ? 'bg-red-100 text-red-600'
    : 'bg-amber-100 text-amber-700';

export const MetaShopOrderDetailCard: React.FC<Props> = ({
  order, shop, shopBaseUrl, lang, onStatusChange, showShopName,
  customerAccounts = [], commissionView, partnerCommissionPercent,
}) => {
  const T = lang === 'fa';
  const shopType = order.shopType || shop?.type;
  const slug = shop?.slug || metaShopsSlugFallback(order);

  const productLink = (productId: string) =>
    `${shopBaseUrl}?shop=${encodeURIComponent(slug)}&product=${encodeURIComponent(productId)}`;

  const productImage = (productId: string) => {
    const p = shop?.products?.find(x => x.id === productId);
    return p?.images?.[0];
  };

  const statusLabel = (s: MetaShopOrder['status']) =>
    s === 'new' ? (T ? 'جدید' : 'New')
      : s === 'in_progress' ? (T ? 'در حال انجام' : 'In progress')
      : s === 'done' ? (T ? 'انجام شد' : 'Done')
      : T ? 'لغو شد' : 'Cancelled';

  const allNeg = order.items.length > 0 && order.items.every(it => it.priceHidden);
  const someNeg = order.items.some(it => it.priceHidden);
  const commission = orderPartnerCommission(order, customerAccounts);
  const effectivePct = partnerCommissionPercent ?? commission.percent;
  const showCommission = effectivePct > 0 && order.status !== 'cancelled' && !allNeg;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {showShopName && (
            <div className="text-xs font-bold text-indigo-600 mb-1">{order.shopName}</div>
          )}
          <div className="font-bold text-gray-800 text-sm">{order.customerName}</div>
          {order.company && <div className="text-xs text-gray-500">{order.company}</div>}
          <div className="text-xs text-gray-400 font-mono mt-1" dir="ltr">
            {order.trackingCode}
            {order.via === 'gsite' && (
              <span className="inline-flex items-center gap-0.5 ms-1 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-sans font-bold">
                🌐 {T ? 'گوگل‌سایت' : 'GSite'}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 mt-1" dir="ltr">
            {new Date(order.createdAt).toLocaleString(T ? 'fa-IR' : 'en-US')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onStatusChange ? (
            <select
              value={order.status}
              onChange={e => onStatusChange(e.target.value as MetaShopOrder['status'])}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium border-0 outline-none cursor-pointer ${statusCls(order.status)}`}
            >
              <option value="new">{statusLabel('new')}</option>
              <option value="in_progress">{statusLabel('in_progress')}</option>
              <option value="done">{statusLabel('done')}</option>
              <option value="cancelled">{statusLabel('cancelled')}</option>
            </select>
          ) : (
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusCls(order.status)}`}>
              {statusLabel(order.status)}
            </span>
          )}
          {shopType === 'realestate' ? (
            <span className="text-amber-700 text-sm font-bold">{T ? 'درخواست بازدید' : 'Viewing request'}</span>
          ) : allNeg ? (
            <span className="text-emerald-600 text-sm font-bold">{T ? 'قابل مذاکره' : 'Negotiable'}</span>
          ) : (
            <span className="text-sm font-bold text-gray-800">
              {order.currency} {order.total.toLocaleString()}
              {someNeg && <span className="text-emerald-600 text-[11px] font-medium"> + {T ? 'قابل مذاکره' : 'Negotiable'}</span>}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
        <div><span className="text-gray-400">{T ? 'تلفن' : 'Phone'}:</span> <span dir="ltr">{order.phone}</span></div>
        {order.email && <div><span className="text-gray-400">{T ? 'ایمیل' : 'Email'}:</span> <span dir="ltr">{order.email}</span></div>}
        {(order.city || order.country) && (
          <div><span className="text-gray-400">{T ? 'موقعیت' : 'Location'}:</span> {[order.city, order.country].filter(Boolean).join(' · ')}</div>
        )}
      </div>

      {order.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">📝 {order.notes}</p>
      )}

      <div>
        <div className="text-xs font-bold text-gray-500 mb-2">{T ? 'اقلام سفارش' : 'Order items'}</div>
        <div className="space-y-2">
          {order.items.map((it, i) => {
            const img = productImage(it.productId);
            const link = productLink(it.productId);
            return (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50/50">
                {img ? (
                  <a href={link} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                  </a>
                ) : (
                  <div className="w-14 h-14 shrink-0 rounded-lg border border-dashed border-gray-200 bg-white flex items-center justify-center text-[10px] text-gray-300">
                    {T ? 'بدون عکس' : 'No img'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a href={link} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-700 hover:underline truncate block">
                    {it.name}
                  </a>
                  <div className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                    {shopType !== 'realestate' && <span>× {it.qty}</span>}
                    {it.sku && <span dir="ltr">SKU: {it.sku}</span>}
                    {it.optionLabel && <span>{it.optionLabel}</span>}
                    {it.priceHidden && shopType !== 'realestate' && (
                      <span className="text-emerald-600 font-bold">{T ? 'قابل مذاکره' : 'Negotiable'}</span>
                    )}
                    {!it.priceHidden && it.lineTotal != null && (
                      <span>{it.currency || order.currency} {it.lineTotal.toLocaleString()}</span>
                    )}
                  </div>
                  <a href={link} target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 hover:text-indigo-500 mt-1 inline-block truncate max-w-full" dir="ltr">
                    {link.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(order.discountAmount || (order.fees?.length ?? 0) > 0 || order.taxAmount) && (
        <div className="text-xs space-y-1 pt-2 border-t border-gray-100">
          {order.discountAmount ? (
            <div className="text-rose-600">− {order.currency} {order.discountAmount.toLocaleString()} ({order.discountCode})</div>
          ) : null}
          {(order.fees || []).map((f, i) => (
            <div key={i} className="text-emerald-600">+ {f.label}: {f.currency || order.currency} {f.amount.toLocaleString()}</div>
          ))}
          {order.taxAmount ? (
            <div className="text-gray-500">
              {order.taxInclusive ? (T ? 'شامل مالیات' : 'incl. tax') : (T ? '+ مالیات' : '+ tax')} {order.taxRate}%: {order.currency} {order.taxAmount.toLocaleString()}
            </div>
          ) : null}
        </div>
      )}

      {showCommission && (
        <div className="text-xs rounded-lg px-3 py-2 border bg-violet-50 border-violet-100 text-violet-900 space-y-0.5">
          <div className="font-semibold">
            {commissionView === 'partner'
              ? (T ? 'کمیسیون همکاری (قابل پرداخت)' : 'Partner commission (payable)')
              : (T ? 'سود همکاری' : 'Partner commission')}
          </div>
          {commission.accountName && commissionView === 'master' && (
            <div className="text-violet-700">{T ? 'همکار' : 'Partner'}: {commission.accountName}</div>
          )}
          <div>
            {effectivePct}% — {order.currency} {commission.amount.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

function metaShopsSlugFallback(order: MetaShopOrder): string {
  return order.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || order.shopId;
}
