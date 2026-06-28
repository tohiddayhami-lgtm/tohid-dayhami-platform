import React, { useMemo } from 'react';
import { MetaShop, MetaShopLang, MetaShopDisplayCurrency } from '../types';
import { Language } from '../App';
import { DEFAULT_PRODUCT_LANGS, DEFAULT_REALESTATE_LANGS, isRtlLang } from '../utils/metaShopLang';
import { currencyPresetLabel, suggestDisplayCurrency } from '../utils/metaShopCurrency';
import { IconPlus, IconTrash } from './Icons';

interface Props {
  shop: MetaShop;
  draft: Partial<MetaShop>;
  lang: Language;
  saving?: boolean;
  saved?: boolean;
  onChange: (patch: Partial<MetaShop>) => void;
  onSave: () => void;
}

const LANG_PRESETS: MetaShopLang[] = [
  { code: 'fa', name: 'فارسی', rtl: true },
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'zh', name: '中文' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'ru', name: 'Русский' },
  { code: 'es', name: 'Español' },
  { code: 'hi', name: 'हिन्दी' },
];

const CUR_PRESETS = ['OMR', 'USD', 'AED', 'IRR', 'EUR', 'SAR', 'GBP', 'CNY', 'QAR', 'KWD', 'BHD'];

export const CustomerMetaShopLocaleEditor: React.FC<Props> = ({
  shop, draft, lang, saving, saved, onChange, onSave,
}) => {
  const T = lang === 'fa';
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  const shopLangs = draft.languages || [];
  const baseCurrency = (draft.currency || shop.currency || 'USD').trim().toUpperCase();
  const displayCurrencies = draft.displayCurrencies || [];

  const langOptions = useMemo((): MetaShopLang[] => {
    const configured = shopLangs.filter(l => l.code?.trim());
    if (configured.length) return configured;
    return shop.type === 'realestate' ? DEFAULT_REALESTATE_LANGS : DEFAULT_PRODUCT_LANGS;
  }, [shopLangs, shop.type]);

  const upd = (patch: Partial<MetaShop>) => onChange(patch);

  const setShopI18n = (code: string, field: string, value: string) => {
    const i18n = { ...(draft.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: value };
    upd({ i18n });
  };

  const shopI18nField = (code: string, field: 'title' | 'subtitle' | 'collectionText'): string => {
    if (code === 'fa') {
      if (field === 'title') return draft.title || shop.title || '';
      if (field === 'subtitle') return draft.subtitle || shop.subtitle || '';
      return draft.collectionText || shop.collectionText || '';
    }
    return draft.i18n?.[code]?.[field] || '';
  };

  const setShopI18nOrMain = (code: string, field: 'title' | 'subtitle' | 'collectionText', value: string) => {
    if (code === 'fa') {
      upd({ [field]: value });
      return;
    }
    setShopI18n(code, field, value);
  };

  const addLangPreset = (preset: MetaShopLang) => {
    if (shopLangs.some(l => l.code === preset.code)) return;
    upd({ languages: [...shopLangs, { ...preset }] });
  };

  const updLang = (idx: number, patch: Partial<MetaShopLang>) => {
    const list = [...shopLangs];
    list[idx] = { ...list[idx], ...patch };
    upd({ languages: list });
  };

  const removeLang = (idx: number) => upd({ languages: shopLangs.filter((_, i) => i !== idx) });

  const addDisplayCurrency = (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c || c === baseCurrency) return;
    if (displayCurrencies.some(x => x.code.trim().toUpperCase() === c)) return;
    upd({ displayCurrencies: [...displayCurrencies, suggestDisplayCurrency(baseCurrency, c)] });
  };

  const updDisplayCurrency = (idx: number, patch: Partial<MetaShopDisplayCurrency>) => {
    const list = [...displayCurrencies];
    list[idx] = { ...list[idx], ...patch };
    upd({ displayCurrencies: list });
  };

  return (
    <div className="space-y-6">
      {/* ── Languages ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{T ? 'زبان‌های فروشگاه' : 'Shop languages'}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {T
              ? 'مشتریان می‌توانند بین این زبان‌ها سوییچ کنند. زبان پیش‌فرض همان زبان اول باز شدن فروشگاه است.'
              : 'Visitors can switch between these languages. Default is the language the shop opens in.'}
          </p>
        </div>

        <div>
          <label className={lbl}>{T ? 'زبان پیش‌فرض (اول باز شدن)' : 'Default language'}</label>
          <select
            className={fld + ' max-w-xs'}
            value={draft.defaultLang || langOptions[0]?.code || 'fa'}
            onChange={e => upd({ defaultLang: e.target.value })}
          >
            {langOptions.map(l => (
              <option key={l.code} value={l.code}>{l.name || l.code}</option>
            ))}
          </select>
        </div>

        <div>
          <p className={lbl}>{T ? 'افزودن سریع زبان' : 'Quick add language'}</p>
          <div className="flex flex-wrap gap-2">
            {LANG_PRESETS.map(preset => {
              const added = shopLangs.some(l => l.code === preset.code);
              return (
                <button
                  key={preset.code}
                  type="button"
                  disabled={added}
                  onClick={() => addLangPreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    added
                      ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-default'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  {preset.name} {added ? '✓' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        {shopLangs.length > 0 && (
          <div className="space-y-2">
            <p className={lbl}>{T ? 'زبان‌های فعال' : 'Active languages'}</p>
            {shopLangs.map((lg, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-gray-100 bg-gray-50/50">
                <input
                  className="w-14 px-2 py-1.5 rounded-lg border border-gray-200 text-xs dir-ltr text-center font-mono"
                  value={lg.code}
                  onChange={e => updLang(idx, { code: e.target.value.trim().toLowerCase() })}
                  placeholder="en"
                />
                <input
                  className="flex-1 min-w-[100px] px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                  value={lg.name}
                  onChange={e => updLang(idx, { name: e.target.value })}
                  placeholder={T ? 'نام زبان' : 'Language name'}
                />
                <label className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                  <input type="checkbox" checked={!!lg.rtl} onChange={e => updLang(idx, { rtl: e.target.checked })} className="rounded" />
                  RTL
                </label>
                <button type="button" onClick={() => removeLang(idx)} className="p-1.5 text-gray-300 hover:text-red-500">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => upd({ languages: [...shopLangs, { code: '', name: '' }] })}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              <IconPlus className="w-3.5 h-3.5" />{T ? 'زبان سفارشی' : 'Custom language'}
            </button>
          </div>
        )}

        {shopLangs.length === 0 && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            {T ? 'اگر زبان اضافه نکنید، فارسی و انگلیسی به‌صورت پیش‌فرض فعال می‌مانند.' : 'If empty, Persian and English are used by default.'}
          </p>
        )}

        {/* Shop titles per language */}
        {langOptions.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">{T ? 'عنوان فروشگاه به هر زبان' : 'Shop title in each language'}</p>
            {langOptions.map(lg => (
              <div key={lg.code} className="space-y-2 p-3 rounded-xl bg-sky-50/50 border border-sky-100">
                <p className="text-xs font-bold text-sky-800">{lg.name || lg.code}</p>
                <div>
                  <label className={lbl}>{T ? 'عنوان' : 'Title'}</label>
                  <input
                    className={fld + (!isRtlLang(lg.code, langOptions) ? ' dir-ltr' : '')}
                    value={shopI18nField(lg.code, 'title')}
                    onChange={e => setShopI18nOrMain(lg.code, 'title', e.target.value)}
                  />
                </div>
                <div>
                  <label className={lbl}>{T ? 'زیرعنوان' : 'Subtitle'}</label>
                  <input
                    className={fld + (!isRtlLang(lg.code, langOptions) ? ' dir-ltr' : '')}
                    value={shopI18nField(lg.code, 'subtitle')}
                    onChange={e => setShopI18nOrMain(lg.code, 'subtitle', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Currencies ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{T ? 'ارز نمایش' : 'Display currency'}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {T
              ? 'ارز اصلی قیمت‌ها در پنل شماست. ارزهای دیگر برای سوییچ مشتری در فروشگاه — نرخ تبدیل را وارد کنید.'
              : 'Base currency is how you set prices. Extra currencies let visitors switch — enter conversion rates.'}
          </p>
        </div>

        <div>
          <label className={lbl}>{T ? 'ارز اصلی (پایه)' : 'Base currency'}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {CUR_PRESETS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => upd({ currency: c })}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  baseCurrency === c
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
            value={draft.currency || shop.currency || ''}
            onChange={e => upd({ currency: e.target.value.toUpperCase() })}
            placeholder="USD"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            {currencyPresetLabel(baseCurrency, T ? 'fa' : 'en')}
          </p>
        </div>

        <div>
          <p className={lbl}>{T ? 'ارزهای دیگر (چندارزی)' : 'Extra currencies (multi-currency)'}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {CUR_PRESETS.filter(c => c !== baseCurrency).map(c => {
              const added = displayCurrencies.some(x => x.code.trim().toUpperCase() === c);
              return (
                <button
                  key={c}
                  type="button"
                  disabled={added}
                  onClick={() => addDisplayCurrency(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${
                    added ? 'bg-gray-100 text-gray-400 border-gray-100' : 'bg-white border-gray-200 hover:border-emerald-400 text-gray-600'
                  }`}
                >
                  + {c}
                </button>
              );
            })}
          </div>

          {displayCurrencies.length === 0 ? (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              {T ? `فقط ${baseCurrency} نمایش داده می‌شود. برای چندارزی، ارز اضافه کنید.` : `Only ${baseCurrency} shown. Add currencies for multi-currency.`}
            </p>
          ) : (
            <div className="space-y-2">
              {displayCurrencies.map((dc, idx) => (
                <div key={`${dc.code}-${idx}`} className="p-3 rounded-xl border border-gray-100 bg-emerald-50/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-emerald-800">{dc.code}</span>
                    <button type="button" onClick={() => upd({ displayCurrencies: displayCurrencies.filter((_, i) => i !== idx) })} className="text-gray-300 hover:text-red-500">
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {T ? `۱ ${baseCurrency} =` : `1 ${baseCurrency} =`}
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="mx-1.5 w-24 px-2 py-1 rounded border border-gray-200 text-xs dir-ltr inline-block"
                      value={dc.rate ?? ''}
                      onChange={e => updDisplayCurrency(idx, { rate: parseFloat(e.target.value) || 0 })}
                    />
                    {dc.code}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>{T ? 'نام (فارسی)' : 'Label (FA)'}</label>
                      <input className={fld + ' text-xs'} value={dc.label || ''} onChange={e => updDisplayCurrency(idx, { label: e.target.value })} placeholder={currencyPresetLabel(dc.code, 'fa')} />
                    </div>
                    <div>
                      <label className={lbl}>{T ? 'نام (English)' : 'Label (EN)'}</label>
                      <input className={fld + ' text-xs dir-ltr'} value={dc.labelEn || ''} onChange={e => updDisplayCurrency(idx, { labelEn: e.target.value })} placeholder={currencyPresetLabel(dc.code, 'en')} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
        >
          {saving ? '...' : saved ? (T ? 'ذخیره شد ✓' : 'Saved ✓') : (T ? 'ذخیره زبان و ارز' : 'Save language & currency')}
        </button>
      </div>
    </div>
  );
};
