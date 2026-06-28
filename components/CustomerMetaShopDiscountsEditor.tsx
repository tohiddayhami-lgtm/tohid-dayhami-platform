import React from 'react';
import { MetaShopDiscount } from '../types';
import { Language } from '../App';
import { IconPlus, IconTrash } from './Icons';

interface Props {
  discounts: MetaShopDiscount[];
  currency: string;
  lang: Language;
  saving?: boolean;
  saved?: boolean;
  onChange: (discounts: MetaShopDiscount[]) => void;
  onSave: () => void;
}

const blankDiscount = (): MetaShopDiscount => ({
  id: `disc-${Date.now()}`,
  code: '',
  type: 'percent',
  value: 10,
  scope: 'all',
  active: true,
});

export const CustomerMetaShopDiscountsEditor: React.FC<Props> = ({
  discounts, currency, lang, saving, saved, onChange, onSave,
}) => {
  const T = lang === 'fa';
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  const upd = (id: string, patch: Partial<MetaShopDiscount>) => {
    onChange(discounts.map(d => d.id === id ? { ...d, ...patch } : d));
  };

  const remove = (id: string) => onChange(discounts.filter(d => d.id !== id));

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
        {T
          ? 'کد تخفیف بسازید تا مشتریان هنگام ثبت سفارش آن را وارد کنند. مثلاً NOWRUZ با ۱۰٪ تخفیف.'
          : 'Create discount codes customers enter at checkout — e.g. NOWRUZ for 10% off.'}
      </div>

      {discounts.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-400 text-sm">
          {T ? 'هنوز کد تخفیفی تعریف نشده است.' : 'No discount codes yet.'}
        </div>
      )}

      <div className="space-y-3">
        {discounts.map(d => (
          <div key={d.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>{T ? 'کد تخفیف' : 'Discount code'}</label>
                  <input
                    className={fld + ' dir-ltr font-mono uppercase'}
                    placeholder="NOWRUZ"
                    value={d.code}
                    onChange={e => upd(d.id, { code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                  />
                </div>
                <div>
                  <label className={lbl}>{T ? 'نوع تخفیف' : 'Type'}</label>
                  <select
                    className={fld}
                    value={d.type}
                    onChange={e => upd(d.id, { type: e.target.value as MetaShopDiscount['type'] })}
                  >
                    <option value="percent">{T ? 'درصدی (٪)' : 'Percent (%)'}</option>
                    <option value="fixed">{T ? `مبلغ ثابت (${currency})` : `Fixed amount (${currency})`}</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>{d.type === 'percent' ? (T ? 'درصد تخفیف' : 'Discount %') : (T ? 'مبلغ تخفیف' : 'Discount amount')}</label>
                  <input
                    type="number"
                    min={0}
                    className={fld + ' dir-ltr'}
                    value={d.value}
                    onChange={e => upd(d.id, { value: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className={lbl}>{T ? 'حداقل مبلغ سفارش (اختیاری)' : 'Min order (optional)'}</label>
                  <input
                    type="number"
                    min={0}
                    className={fld + ' dir-ltr'}
                    placeholder={T ? 'خالی = بدون حداقل' : 'Empty = no minimum'}
                    value={d.minOrder ?? ''}
                    onChange={e => upd(d.id, { minOrder: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
              <button type="button" onClick={() => remove(d.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 mt-5">
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={d.active !== false} onChange={e => upd(d.id, { active: e.target.checked })} className="rounded" />
              <span className="text-xs text-gray-600">{T ? 'فعال — مشتریان می‌توانند استفاده کنند' : 'Active — customers can use this code'}</span>
            </label>
            {d.code && (
              <p className="text-[11px] text-gray-400">
                {T ? 'پیش‌نمایش:' : 'Preview:'}{' '}
                <span className="font-mono text-indigo-600">{d.code}</span>
                {' → '}
                {d.type === 'percent' ? `${d.value}٪` : `${currency} ${d.value.toLocaleString()}`}
                {T ? ' تخفیف' : ' off'}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...discounts, blankDiscount()])}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 flex items-center justify-center gap-2 transition-colors"
      >
        <IconPlus className="w-4 h-4" />
        {T ? 'افزودن کد تخفیف جدید' : 'Add new discount code'}
      </button>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
        >
          {saving ? '...' : saved ? (T ? 'ذخیره شد ✓' : 'Saved ✓') : (T ? 'ذخیره کدهای تخفیف' : 'Save discount codes')}
        </button>
      </div>
    </div>
  );
};
