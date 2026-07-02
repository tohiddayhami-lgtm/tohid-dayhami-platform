import React, { useState } from 'react';
import type { MetaShopPriceHistoryEntry } from '../types';
import { priceHistorySummary } from '../utils/metaShopPriceHistory';

interface Props {
  T: boolean;
  history?: MetaShopPriceHistoryEntry[];
  onClear?: () => void;
}

const kindBadge = (kind: MetaShopPriceHistoryEntry['kind'], T: boolean) => {
  const map: Record<MetaShopPriceHistoryEntry['kind'], { fa: string; en: string; cls: string }> = {
    bulk_commit: { fa: 'ثبت تجمیعی', en: 'Bulk commit', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
    bulk_revert: { fa: 'برگشت تجمیعی', en: 'Bulk revert', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
    bulk_temp_clear: { fa: 'لغو موقت', en: 'Temp cleared', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    product_revert: { fa: 'برگشت محصول', en: 'Product revert', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
    manual_edit: { fa: 'ویرایش دستی', en: 'Manual edit', cls: 'bg-violet-100 text-violet-800 border-violet-200' },
  };
  const m = map[kind] || map.manual_edit;
  return { label: T ? m.fa : m.en, cls: m.cls };
};

const fmtWhen = (iso: string, T: boolean) => {
  try {
    return new Date(iso).toLocaleString(T ? 'fa-IR' : 'en-GB', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const MetaShopPriceHistoryPanel: React.FC<Props> = ({ T, history, onClear }) => {
  const [open, setOpen] = useState(false);
  const items = history || [];
  if (!items.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-start hover:bg-gray-50"
      >
        <span className="text-sm font-bold text-gray-800">
          {T ? 'تاریخچه تغییرات قیمت' : 'Price change history'}
          <span className="ms-2 text-xs font-normal text-gray-500">({items.length})</span>
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 py-2 max-h-64 overflow-y-auto space-y-2">
          {items.map(entry => {
            const badge = kindBadge(entry.kind, T);
            return (
              <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                  <span className="text-gray-500">{fmtWhen(entry.at, T)}</span>
                  {entry.by && <span className="text-gray-400">· {entry.by}</span>}
                </div>
                <p className="text-gray-800 leading-snug">{priceHistorySummary(entry, T ? 'fa' : 'en')}</p>
              </div>
            );
          })}
          {onClear && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(T ? 'کل تاریخچه قیمت پاک شود؟' : 'Clear entire price history?')) return;
                onClear();
              }}
              className="text-[11px] text-red-500 hover:text-red-700 px-1"
            >
              {T ? 'پاک کردن تاریخچه' : 'Clear history'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
