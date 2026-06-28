import React from 'react';
import { MetaShopProduct, MetaShopPriceTier } from '../types';
import { MAX_PRICE_TIERS, newPriceTier, seedTiersFromLegacy, syncLegacyPricesFromTiers, TIER_LABEL_PRESETS_FA, TIER_LABEL_PRESETS_EN } from '../utils/metaShopPriceTiers';
import { IconPlus, IconTrash } from './Icons';

const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';

interface Props {
  T: boolean;
  product: MetaShopProduct;
  currency: string;
  onChange: (patch: Partial<MetaShopProduct>) => void;
}

export const MetaShopProductPriceTiersEditor: React.FC<Props> = ({ T, product, currency, onChange }) => {
  const tiers = product.priceTiers || [];

  const setTiers = (next: MetaShopPriceTier[]) => {
    const trimmed = next.slice(0, MAX_PRICE_TIERS);
    onChange({ priceTiers: trimmed.length ? trimmed : undefined, ...syncLegacyPricesFromTiers({ ...product, priceTiers: trimmed }) });
  };

  const updTier = (idx: number, patch: Partial<MetaShopPriceTier>) => {
    const next = tiers.map((t, i) => {
      if (i !== idx) return t;
      const merged = { ...t, ...patch };
      if (patch.price != null) merged.basePrice = patch.price;
      return merged;
    });
    setTiers(next);
  };

  const addTier = (presetIdx?: number) => {
    if (tiers.length >= MAX_PRICE_TIERS) return;
    const presetFa = presetIdx != null ? TIER_LABEL_PRESETS_FA[presetIdx] : undefined;
    const presetEn = presetIdx != null ? TIER_LABEL_PRESETS_EN[presetIdx] : undefined;
    setTiers([...tiers, newPriceTier({
      label: presetFa || (T ? 'سطح جدید' : 'New tier'),
      labelEn: presetEn,
      price: 0,
      currency: product.currency || currency,
      unitsInPack: presetIdx === 0 ? 1 : undefined,
    })]);
  };

  const enableFromLegacy = () => {
    setTiers(seedTiersFromLegacy(product));
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-[11px] font-bold text-gray-700 block">
            {T ? 'سطوح قیمت خرید عمده (حداکثر ۳)' : 'Bulk price tiers (max 3)'}
          </label>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {T
              ? 'مثلاً: یک عدد / یک جعبه / یک کارتن — مشتری هنگام خرید یکی را انتخاب می‌کند.'
              : 'e.g. per unit / per box / bulk — customer picks one at checkout.'}
          </p>
        </div>
        {tiers.length < MAX_PRICE_TIERS && (
          <button type="button" onClick={() => addTier()} className="text-[11px] px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1">
            <IconPlus className="w-3 h-3" />
            {T ? 'افزودن سطح' : 'Add tier'}
          </button>
        )}
      </div>

      {tiers.length === 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-400">
            {T ? 'فعلاً فقط قیمت تکی/بسته دارید. برای چند قیمت، سطوح را فعال کنید.' : 'Single/pack price only. Enable tiers for multiple prices.'}
          </p>
          <button type="button" onClick={enableFromLegacy} className="text-[11px] px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            {T ? 'فعال‌سازی از قیمت فعلی' : 'Enable from current prices'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {TIER_LABEL_PRESETS_FA.map((label, i) => (
              tiers.length < MAX_PRICE_TIERS && (
                <button
                  key={label}
                  type="button"
                  onClick={() => addTier(i)}
                  className="text-[10px] px-2 py-1 rounded-full border border-gray-200 bg-white hover:border-indigo-300 text-gray-600"
                >
                  + {label}
                </button>
              )
            ))}
          </div>
          <div className="space-y-2">
            {tiers.map((tier, idx) => (
              <div key={tier.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="md:col-span-3">
                  <label className="text-[10px] text-gray-500">{T ? 'عنوان' : 'Label'}</label>
                  <input className={fld + ' text-xs'} value={tier.label} onChange={e => updTier(idx, { label: e.target.value })} placeholder={T ? 'یک جعبه' : 'Per box'} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-gray-500">EN</label>
                  <input className={fld + ' text-xs dir-ltr'} value={tier.labelEn || ''} onChange={e => updTier(idx, { labelEn: e.target.value })} placeholder="Per box" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-gray-500">{T ? 'قیمت' : 'Price'}</label>
                  <input type="number" step="any" min={0} className={fld + ' text-xs dir-ltr'} value={tier.price ?? ''} onChange={e => updTier(idx, { price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-gray-500">{T ? 'تعداد در بسته' : 'Units in pack'}</label>
                  <input type="number" step="any" min={1} className={fld + ' text-xs dir-ltr'} value={tier.unitsInPack ?? ''} onChange={e => updTier(idx, { unitsInPack: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder={T ? 'مثلاً 12' : 'e.g. 12'} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-gray-500">{T ? 'ارز' : 'Currency'}</label>
                  <input className={fld + ' text-xs dir-ltr'} value={tier.currency || ''} onChange={e => updTier(idx, { currency: e.target.value.toUpperCase() || undefined })} placeholder={currency} />
                </div>
                <div className="md:col-span-1 flex justify-end pb-1">
                  <button type="button" onClick={() => setTiers(tiers.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
