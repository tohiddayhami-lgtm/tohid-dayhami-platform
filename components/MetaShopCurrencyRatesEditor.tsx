import React, { useMemo, useState } from 'react';
import { MetaShopDisplayCurrency } from '../types';
import { Language } from '../App';
import {
  CURRENCY_PRESETS,
  buildCrossRatePreview,
  currencyPresetLabel,
  displayCurrencyLabel,
  formatMarketRate,
  formatRateEquation,
  inputValueFromStoredRate,
  normalizeDisplayCurrencies,
  parseMarketRateInput,
  preferredRateInputMode,
  shopDisplayCurrencies,
  storedRateFromInput,
  suggestDisplayCurrency,
  type RateInputSide,
} from '../utils/metaShopCurrency';
import { IconTrash } from './Icons';
import type { MetaShop } from '../types';

interface Props {
  baseCurrency: string;
  displayCurrencies: MetaShopDisplayCurrency[];
  defaultDisplayCurrency?: string;
  lang: Language;
  onBaseChange: (code: string) => void;
  onDisplayCurrenciesChange: (list: MetaShopDisplayCurrency[]) => void;
  onDefaultDisplayCurrencyChange?: (code: string | undefined) => void;
  compact?: boolean;
}

export const MetaShopCurrencyRatesEditor: React.FC<Props> = ({
  baseCurrency,
  displayCurrencies,
  defaultDisplayCurrency,
  lang,
  onBaseChange,
  onDisplayCurrenciesChange,
  onDefaultDisplayCurrencyChange,
  compact,
}) => {
  const T = lang === 'fa';
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [rateModes, setRateModes] = useState<Record<string, RateInputSide>>({});
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
  const storefrontCurrencies = useMemo(() => shopDisplayCurrencies(previewShop), [previewShop]);
  const resolvedDefault = defaultDisplayCurrency?.trim().toUpperCase() || base;

  const setDefaultDisplay = (code: string) => {
    if (!onDefaultDisplayCurrencyChange) return;
    const c = code.trim().toUpperCase();
    onDefaultDisplayCurrencyChange(c === base ? undefined : c);
  };

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
    const removed = normalized[idx]?.code?.trim().toUpperCase();
    onDisplayCurrenciesChange(normalized.filter((_, i) => i !== idx));
    if (removed && resolvedDefault === removed) setDefaultDisplay(base);
  };

  return (
    <div className="space-y-4">
      <div>
        <h5 className={`font-bold text-gray-800 ${compact ? 'text-sm mb-1' : 'text-sm mb-1'}`}>
          {T ? 'نرخ ارز بازار' : 'Market exchange rates'}
        </h5>
        <p className="text-xs text-gray-500 leading-relaxed">
          {T
            ? `نرخ واقعی بازار را وارد کنید — هر دو جهت مجاز است: «۱ ${base} = …» یا «۱ ارز دیگر = … ${base}». مثلاً ۱ OMR = ۴۴۵۰۰۰ ${base}. سیستم بقیه تبدیل‌ها را خودکار محاسبه می‌کند.`
            : `Enter real market rates — either direction works: «1 ${base} = …» or «1 other = … ${base}». E.g. 1 OMR = 445000 ${base}. All other conversions are computed automatically.`}
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

      {onDefaultDisplayCurrencyChange && (
        <div>
          <label className={lbl}>{T ? 'ارز پیش‌فرض نمایش (اول باز شدن فروشگاه)' : 'Default display currency (shop opens in)'}</label>
          <select
            className={fld + ' max-w-xs dir-ltr font-mono bg-white'}
            value={resolvedDefault}
            onChange={e => setDefaultDisplay(e.target.value)}
          >
            {storefrontCurrencies.map(dc => (
              <option key={dc.code} value={dc.code}>
                {dc.code} — {displayCurrencyLabel(dc, T ? 'fa' : 'en')}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            {T ? 'مشتری می‌تواند در فروشگاه ارز دیگری انتخاب کند (مثل زبان).' : 'Visitors can switch currency in the shop (like language).'}
          </p>
        </div>
      )}

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
              ? `فقط ${base} در فروشگاه نمایش داده می‌شود. ارز اضافه کنید و نرخ بازار را به هر جهتی که راحت‌تر است وارد کنید.`
              : `Only ${base} is shown. Add currencies and enter market rates in whichever direction is easier.`}
          </p>
        ) : (
          <div className="space-y-2">
            {normalized.map((dc, idx) => {
              const mode = rateModes[dc.code] ?? preferredRateInputMode(dc.rate);
              const leftCur = mode === 'baseToCode' ? base : dc.code;
              const rightCur = mode === 'baseToCode' ? dc.code : base;
              const draftKey = `${dc.code}:${mode}`;
              const displayVal = rateDrafts[draftKey] ?? (
                dc.rate ? formatMarketRate(inputValueFromStoredRate(dc.rate, mode)) : ''
              );

              const flipMode = () => {
                const next: RateInputSide = mode === 'baseToCode' ? 'codeToBase' : 'baseToCode';
                setRateModes(m => ({ ...m, [dc.code]: next }));
                setRateDrafts(d => {
                  const nextDrafts = { ...d };
                  delete nextDrafts[`${dc.code}:baseToCode`];
                  delete nextDrafts[`${dc.code}:codeToBase`];
                  return nextDrafts;
                });
              };

              return (
              <div key={dc.code} className="p-3 rounded-xl border border-gray-100 bg-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-sm text-indigo-800">{dc.code}</span>
                  <button type="button" onClick={() => removeCurrency(idx)} className="text-gray-300 hover:text-red-500">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700" dir="ltr">
                  <button
                    type="button"
                    onClick={flipMode}
                    title={T ? 'جابه‌جایی جهت نرخ' : 'Flip rate direction'}
                    className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 shrink-0"
                  >
                    ⇄
                  </button>
                  <span className="font-mono whitespace-nowrap">1 {leftCur} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-32 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-mono dir-ltr"
                    value={displayVal}
                    onChange={e => {
                      const v = e.target.value;
                      setRateDrafts(d => ({ ...d, [draftKey]: v }));
                      const parsed = parseMarketRateInput(v);
                      const stored = storedRateFromInput(parsed, mode);
                      if (stored > 0) updCurrency(idx, { rate: stored });
                    }}
                    onBlur={() => setRateDrafts(d => {
                      const next = { ...d };
                      delete next[draftKey];
                      return next;
                    })}
                    placeholder="0"
                  />
                  <span className="font-mono font-semibold">{rightCur}</span>
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
              );
            })}
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
