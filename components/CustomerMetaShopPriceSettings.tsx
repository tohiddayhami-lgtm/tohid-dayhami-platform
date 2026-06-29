import React, { useMemo } from 'react';
import { Language } from '../App';
import { MetaShopLang } from '../types';
import { DEFAULT_PRODUCT_LANGS } from '../utils/metaShopLang';

interface Props {
  hidePrices: boolean;
  hidePriceText?: string;
  shopLangs?: MetaShopLang[];
  shopI18n?: Record<string, Record<string, string>>;
  lang: Language;
  onChange: (patch: {
    hidePrices?: boolean;
    hidePriceText?: string;
    i18n?: Record<string, Record<string, string>>;
  }) => void;
}

const PRESET_FA = 'لطفاً برای قیمت جدید تماس بگیرید';
const PRESET_EN = 'Please contact us for the new price';

export const CustomerMetaShopPriceSettings: React.FC<Props> = ({
  hidePrices, hidePriceText, shopLangs = [], shopI18n, lang, onChange,
}) => {
  const T = lang === 'fa';
  const showPrices = !hidePrices;
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';

  const langOptions = useMemo(() => {
    const configured = shopLangs.filter(l => l.code?.trim());
    return configured.length ? configured : DEFAULT_PRODUCT_LANGS;
  }, [shopLangs]);

  const hidePriceForLang = (code: string): string => {
    if (code === 'fa') return hidePriceText || '';
    if (code === 'en') return shopI18n?.en?.hidePriceText ?? hidePriceText ?? '';
    return shopI18n?.[code]?.hidePriceText || '';
  };

  const setHidePriceForLang = (code: string, value: string) => {
    const trimmed = value.trim();
    if (code === 'fa') {
      onChange({ hidePriceText: trimmed || undefined });
      return;
    }
    const i18n = { ...(shopI18n || {}) };
    const row = { ...(i18n[code] || {}) };
    if (trimmed) row.hidePriceText = trimmed;
    else delete row.hidePriceText;
    if (Object.keys(row).length) i18n[code] = row;
    else delete i18n[code];
    onChange({ i18n });
  };

  const applyPreset = (code: string, preset: string) => setHidePriceForLang(code, preset);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-800">{T ? 'نمایش قیمت در فروشگاه' : 'Price display'}</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {T
            ? 'وقتی قیمت مخفی باشد، مشتری فقط تعداد ثبت می‌کند و بعداً با شما هماهنگ می‌کند.'
            : 'When hidden, customers order quantities only and contact you for pricing.'}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ hidePrices: false })}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
            showPrices ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          {T ? '✓ نمایش قیمت‌ها' : '✓ Show prices'}
        </button>
        <button
          type="button"
          onClick={() => onChange({ hidePrices: true })}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
            !showPrices ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          {T ? 'مخفی — قابل مذاکره' : 'Hidden — negotiable'}
        </button>
      </div>

      {!showPrices && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-600">
            {T ? 'متن جایگزین قیمت (به ازای هر زبان)' : 'Text instead of price (per language)'}
          </p>
          {langOptions.map(lg => {
            const code = lg.code;
            const val = hidePriceForLang(code);
            return (
              <div key={code} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 space-y-2">
                <label className="block text-xs font-bold text-indigo-700">{lg.name || code}</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset(code, '')}
                    className={`text-[10px] px-2 py-1 rounded-md border ${!val ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                    {T ? 'پیش‌فرض' : 'Default'}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(code, code === 'fa' || code === 'ar' ? PRESET_FA : PRESET_EN)}
                    className="text-[10px] px-2 py-1 rounded-md border bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  >
                    {code === 'fa' || code === 'ar' ? PRESET_FA : PRESET_EN}
                  </button>
                </div>
                <input
                  className={fld}
                  placeholder={T ? 'متن دلخواه…' : 'Custom text…'}
                  value={val}
                  onChange={e => setHidePriceForLang(code, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
