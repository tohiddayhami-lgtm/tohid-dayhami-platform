import React, { useMemo, useState } from 'react';
import { MetaShopDisplayCurrency } from '../types';
import { Language } from '../App';
import {
  CURRENCY_PRESETS,
  buildCrossRatePreview,
  currencyPresetLabel,
  formatMarketRate,
  formatRateEquation,
  normalizeDisplayCurrencies,
  parseMarketRateInput,
  suggestDisplayCurrency,
} from '../utils/metaShopCurrency';
import { IconTrash } from './Icons';
import type { MetaShop } from '../types';

interface Props {
  baseCurrency: string;
  displayCurrencies: MetaShopDisplayCurrency[];
  lang: Language;
  onBaseChange: (code: string) => void;
  onDisplayCurrenciesChange: (list: MetaShopDisplayCurrency[]) => void;
  compact?: boolean;
}

export const MetaShopCurrencyRatesEditor: React.FC<Props> = ({
  baseCurrency,
  displayCurrencies,
  lang,
  onBaseChange,
  onDisplayCurrenciesChange,
  compact,
}) => {
  const T = lang === 'fa';
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  const base = baseCurrency.trim().toUpperCase() || 'USD';
  const normalized = useMemo(
    () => normalizeDisplayCurrencies(base, displayCurrencies),
    [base, displayCurrencies],
  );

  const previewShop = useMemo((): MetaShop => ({
    id: 'preview',
    slug: 'preview',
    name: 'Preview',
    type: 'products',
    isActive: true,
    theme: { primary: '#000', cover: '#000', coverText: '#fff', bg: '#fff', heading: '#000', text: '#000' },
    currency: base,
    displayCurrencies: normalized,
    products: [],
  }), [base, normalized]);

  const crossPreview = useMemo(() => buildCrossRatePreview(previewShop), [previewShop]);

  const setBase = (code: string) => {
    const next = code.trim().toUpperCase();
    onBaseChange(next);
    onDisplayCurrenciesChange(normalizeDisplayCurrencies(next, displayCurrencies));
  };

  const addCurrency = (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c || c === base) return;
    if (normalized.some(x => x.code === c)) return;
    onDisplayCurrenciesChange([...normalized, suggestDisplayCurrency(base, c)]);
  };

  const updCurrency = (idx: number, patch: Partial<MetaShopDisplayCurrency>) => {
    const list = [...normalized];
    list[idx] = { ...list[idx], ...patch };
    onDisplayCurrenciesChange(normalizeDisplayCurrencies(base, list));
  };

  const removeCurrency = (idx: number) => {
    onDisplayCurrenciesChange(normalized.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div>
        <h5 className={`font-bold text-gray-800 ${compact ? 'text-sm mb-1' : 'text-sm mb-1'}`}>
          {T ? 'نرخ ارز بازار' : 'Market exchange rates'}
        </h5>
        <p className="text-xs text-gray-500 leading-relaxed">
          {T
            ? `فقط نرخ واقعی بازار را وارد کنید: «۱ ${base} = چند واحد ارز دیگر». سیستم بقیه تبدیل‌ها و قیمت محصولات را خودکار محاسبه می‌کند.`
            : `Enter real market rates only: «1 ${base} = how many units of each currency». All other conversions and product prices are calculated automatically.`}
        </p>
      </div>

      <div>
        <label className={lbl}>{T ? 'ارز پایه (قیمت‌ها با این ارز ثبت می‌شوند)' : 'Base currency (prices are stored in this currency)'}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {CURRENCY_PRESETS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setBase(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                base === c
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          className={fld + ' dir-ltr max-w-[140px] font-mono uppercase'}
          value={base}
          onChange={e => setBase(e.target.value)}
          placeholder="EUR"
        />
        <p className="text-[10px] text-gray-400 mt-1">{currencyPresetLabel(base, T ? 'fa' : 'en')}</p>
      </div>

      <div>
        <p className={lbl}>{T ? 'نرخ ارزها نسبت به پایه' : 'Rates relative to base'}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CURRENCY_PRESETS.filter(c => c !== base).map(c => {
            const added = normalized.some(x => x.code === c);
            return (
              <button
                key={c}
                type="button"
                disabled={added}
                onClick={() => addCurrency(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${
                  added ? 'bg-gray-100 text-gray-400 border-gray-100' : 'bg-white border-gray-200 hover:border-emerald-400 text-gray-600'
                }`}
              >
                + {c}
              </button>
            );
          })}
        </div>

        {normalized.length === 0 ? (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            {T
              ? `فقط ${base} در فروشگاه نمایش داده می‌شود. برای چندارزی، ارز اضافه کنید و نرخ «۱ ${base} = …» را وارد کنید.`
              : `Only ${base} is shown. Add currencies and enter «1 ${base} = …» rates.`}
          </p>
        ) : (
          <div className="space-y-2">
            {normalized.map((dc, idx) => (
              <div key={dc.code} className="p-3 rounded-xl border border-gray-100 bg-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-sm text-indigo-800">{dc.code}</span>
                  <button type="button" onClick={() => removeCurrency(idx)} className="text-gray-300 hover:text-red-500">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700" dir="ltr">
                  <span className="font-mono whitespace-nowrap">1 {base} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-mono dir-ltr"
                    value={rateDrafts[dc.code] ?? (dc.rate ? formatMarketRate(dc.rate) : '')}
                    onChange={e => {
                      const v = e.target.value;
                      setRateDrafts(d => ({ ...d, [dc.code]: v }));
                      const parsed = parseMarketRateInput(v);
                      if (parsed > 0) updCurrency(idx, { rate: parsed });
                    }}
                    onBlur={() => setRateDrafts(d => {
                      const next = { ...d };
                      delete next[dc.code];
                      return next;
                    })}
                    placeholder="0.00"
                  />
                  <span className="font-mono font-semibold">{dc.code}</span>
                </div>
                {!compact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>{T ? 'نام (فارسی)' : 'Label (FA)'}</label>
                      <input className={fld + ' text-xs'} value={dc.label || ''} onChange={e => updCurrency(idx, { label: e.target.value })} placeholder={currencyPresetLabel(dc.code, 'fa')} />
                    </div>
                    <div>
                      <label className={lbl}>{T ? 'نام (English)' : 'Label (EN)'}</label>
                      <input className={fld + ' text-xs dir-ltr'} value={dc.labelEn || ''} onChange={e => updCurrency(idx, { labelEn: e.target.value })} placeholder={currencyPresetLabel(dc.code, 'en')} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {crossPreview.length > 0 && (
        <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3">
          <p className="text-xs font-bold text-slate-700 mb-2">
            {T ? 'نرخ‌های محاسبه‌شده (فقط نمایش — قیمت‌ها با همین نرخ‌ها تبدیل می‌شوند)' : 'Computed rates (display only — prices convert using these)'}
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {crossPreview.map(row => (
              <div
                key={`${row.from}-${row.to}`}
                className={`text-[11px] font-mono dir-ltr px-2 py-1 rounded ${row.direct ? 'bg-white text-slate-800 border border-slate-100' : 'text-slate-500'}`}
              >
                {formatRateEquation(row.from, row.to, row.rate)}
                {row.direct && (
                  <span className="text-[9px] text-emerald-600 font-sans ms-2">
                    {T ? 'ورودی شما' : 'your input'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
