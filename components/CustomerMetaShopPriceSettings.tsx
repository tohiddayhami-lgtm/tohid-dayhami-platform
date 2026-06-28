import React from 'react';
import { Language } from '../App';

interface Props {
  hidePrices: boolean;
  hidePriceText?: string;
  lang: Language;
  onChange: (patch: { hidePrices?: boolean; hidePriceText?: string }) => void;
}

export const CustomerMetaShopPriceSettings: React.FC<Props> = ({
  hidePrices, hidePriceText, lang, onChange,
}) => {
  const T = lang === 'fa';
  const showPrices = !hidePrices;
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';

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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {T ? 'متن جایگزین قیمت' : 'Text instead of price'}
          </label>
          <select
            className={fld}
            value={hidePriceText || ''}
            onChange={e => onChange({ hidePriceText: e.target.value || undefined })}
          >
            <option value="">{T ? 'قابل مذاکره (پیش‌فرض)' : 'Negotiable (default)'}</option>
            <option value="Please contact us for the new price">
              {T ? 'لطفاً برای قیمت جدید تماس بگیرید' : 'Please contact us for the new price'}
            </option>
            <option value="تماس بگیرید">{T ? 'تماس بگیرید' : 'Contact us'}</option>
          </select>
          <input
            className={fld + ' mt-2'}
            placeholder={T ? 'یا متن دلخواه خودتان…' : 'Or your custom text…'}
            value={hidePriceText && !['', 'Please contact us for the new price', 'تماس بگیرید'].includes(hidePriceText) ? hidePriceText : ''}
            onChange={e => onChange({ hidePriceText: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
};
