import React, { useEffect, useMemo, useState } from 'react';
import { AppConfig, MetaShop, MetaShopCurrencyPreset } from '../types';
import { Language } from '../App';
import { MetaShopCurrencyRatesEditor } from './MetaShopCurrencyRatesEditor';
import {
  applyCurrencyPresetToShop,
  normalizeDefaultDisplayCurrency,
  normalizeDisplayCurrencies,
  presetFromShop,
  resolveCurrencyPresets,
  shopBaseCurrency,
} from '../utils/metaShopCurrency';
import { IconCheck } from './Icons';
import type { MetaShopSaveOptions } from '../services/firebaseService';

interface Props {
  metaShops: MetaShop[];
  config: AppConfig;
  lang: Language;
  readonly?: boolean;
  onUpdateConfig: (config: AppConfig) => void | Promise<void>;
  onSaveMetaShop: (shop: MetaShop, opts?: MetaShopSaveOptions) => Promise<void>;
}

const card = 'bg-white rounded-xl border border-gray-100 shadow-sm';

export const MetaShopBulkCurrencyPanel: React.FC<Props> = ({
  metaShops, config, lang, readonly = false, onUpdateConfig, onSaveMetaShop,
}) => {
  const T = lang === 'fa';
  const [drafts, setDrafts] = useState<Record<string, MetaShopCurrencyPreset>>({});
  const [activeBase, setActiveBase] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [applying, setApplying] = useState(false);
  const [importShopId, setImportShopId] = useState('');

  const shopsByBase = useMemo(() => {
    const m = new Map<string, MetaShop[]>();
    for (const s of metaShops) {
      const base = shopBaseCurrency(s);
      const list = m.get(base) || [];
      list.push(s);
      m.set(base, list);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [metaShops]);

  const baseCurrencies = useMemo(() => shopsByBase.map(([b]) => b), [shopsByBase]);

  useEffect(() => {
    const resolved = resolveCurrencyPresets(metaShops, config.metaShopCurrencyPresets);
    setDrafts(resolved);
    setActiveBase(prev => (prev && resolved[prev] ? prev : baseCurrencies[0] || ''));
  }, [metaShops, config.metaShopCurrencyPresets, baseCurrencies]);

  const activePreset = activeBase ? drafts[activeBase] : undefined;
  const activeShops = shopsByBase.find(([b]) => b === activeBase)?.[1] || [];

  const updPreset = (base: string, patch: Partial<MetaShopCurrencyPreset>) => {
    setDrafts(prev => ({
      ...prev,
      [base]: { displayCurrencies: [], ...prev[base], ...patch },
    }));
  };

  const savePresetToConfig = async () => {
    if (readonly || !activeBase || !activePreset) return;
    setSavingPreset(true);
    try {
      await onUpdateConfig({
        ...config,
        metaShopCurrencyPresets: {
          ...(config.metaShopCurrencyPresets || {}),
          [activeBase]: activePreset,
        },
      });
      alert(T ? 'الگوی نرخ ارز ذخیره شد.' : 'Currency preset saved.');
    } finally {
      setSavingPreset(false);
    }
  };

  const applyToAllShops = async (base: string) => {
    if (readonly) return;
    const preset = drafts[base];
    if (!preset) return;
    const targets = shopsByBase.find(([b]) => b === base)?.[1] || [];
    if (!targets.length) return;
    const msg = T
      ? `نرخ ارز روی ${targets.length} فروشگاه با ارز پایه ${base} اعمال شود؟\n(تنظیمات اختصاصی هر فروشگاه بازنویسی می‌شود.)`
      : `Apply exchange rates to ${targets.length} shop(s) with base ${base}?\n(Per-shop currency settings will be overwritten.)`;
    if (!window.confirm(msg)) return;

    setApplying(true);
    try {
      await onUpdateConfig({
        ...config,
        metaShopCurrencyPresets: {
          ...(config.metaShopCurrencyPresets || {}),
          [base]: preset,
        },
      });
      await Promise.all(targets.map(shop => onSaveMetaShop(applyCurrencyPresetToShop(shop, preset))));
      alert(T ? `نرخ ارز روی ${targets.length} فروشگاه اعمال شد.` : `Applied to ${targets.length} shop(s).`);
    } finally {
      setApplying(false);
    }
  };

  const importFromShop = () => {
    if (!importShopId || !activeBase) return;
    const shop = metaShops.find(s => s.id === importShopId);
    if (!shop || shopBaseCurrency(shop) !== activeBase) return;
    updPreset(activeBase, presetFromShop(shop));
  };

  if (!metaShops.length) {
    return (
      <div className={card + ' text-center py-16 text-gray-400 text-sm'}>
        {T ? 'ابتدا یک فروشگاه بسازید.' : 'Create a shop first.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-800">{T ? 'نرخ ارز — اعمال یکپارچه' : 'Exchange rates — bulk apply'}</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">
          {T
            ? 'نرخ ارز را یک‌بار برای هر «ارز پایه» تنظیم کنید و روی همه فروشگاه‌های همان پایه اعمال کنید. برای تغییر تکی، وارد ویرایش همان فروشگاه شوید.'
            : 'Set rates once per base currency and apply to all shops sharing that base. For per-shop overrides, edit the individual shop.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {baseCurrencies.map(base => {
          const count = shopsByBase.find(([b]) => b === base)?.[1].length || 0;
          return (
            <button
              key={base}
              type="button"
              onClick={() => { setActiveBase(base); setImportShopId(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                activeBase === base
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {base}
              <span className="font-sans font-normal opacity-80 ms-1">({count})</span>
            </button>
          );
        })}
      </div>

      {activeBase && activePreset && (
        <div className={card + ' p-4 space-y-4'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              {T
                ? `${activeShops.length} فروشگاه با ارز پایه ${activeBase}`
                : `${activeShops.length} shop(s) with base ${activeBase}`}
            </p>
            {!readonly && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={savePresetToConfig}
                  disabled={savingPreset}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {savingPreset ? '…' : (T ? 'ذخیره الگو' : 'Save preset')}
                </button>
                <button
                  type="button"
                  onClick={() => applyToAllShops(activeBase)}
                  disabled={applying}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <IconCheck className="w-3.5 h-3.5" />
                  {applying ? '…' : (T ? 'اعمال روی همه فروشگاه‌ها' : 'Apply to all shops')}
                </button>
              </div>
            )}
          </div>

          {!readonly && activeShops.length > 1 && (
            <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">
                  {T ? 'بارگذاری از فروشگاه' : 'Import from shop'}
                </label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={importShopId}
                  onChange={e => setImportShopId(e.target.value)}
                >
                  <option value="">{T ? 'انتخاب فروشگاه…' : 'Select shop…'}</option>
                  {activeShops.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.slug}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={importFromShop}
                disabled={!importShopId}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                {T ? 'بارگذاری' : 'Load'}
              </button>
            </div>
          )}

          <MetaShopCurrencyRatesEditor
            lockBase
            baseCurrency={activeBase}
            baseCurrencyLabel={activePreset.currencyLabel}
            baseCurrencyLabelEn={activePreset.currencyLabelEn}
            displayCurrencies={activePreset.displayCurrencies || []}
            defaultDisplayCurrency={activePreset.defaultDisplayCurrency}
            lang={lang}
            onBaseChange={() => {}}
            onBaseLabelsChange={patch => updPreset(activeBase, patch)}
            onDisplayCurrenciesChange={list => updPreset(activeBase, {
              displayCurrencies: normalizeDisplayCurrencies(activeBase, list),
              defaultDisplayCurrency: normalizeDefaultDisplayCurrency(
                activeBase,
                list,
                activePreset.defaultDisplayCurrency,
              ),
            })}
            onDefaultDisplayCurrencyChange={code => updPreset(activeBase, { defaultDisplayCurrency: code })}
          />

          {activeShops.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {T ? 'فروشگاه‌های این گروه' : 'Shops in this group'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeShops.map(s => (
                  <span key={s.id} className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {s.name || s.slug}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
