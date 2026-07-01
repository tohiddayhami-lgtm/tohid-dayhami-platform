import React from 'react';
import { MetaShopProduct, MetaShopPriceMarkupHistoryEntry } from '../types';
import {
  commitMarkupToProducts,
  productHasPriceDrift,
  PROMO_LABEL_PRESETS_FA,
  revertAllProductsToBase,
  revertProductToBase,
  formatPriceMarkupHistoryLine,
  type PriceAdjustType,
} from '../utils/metaShopPricing';

const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';

interface ShopBulkProps {
  T: boolean;
  markupType?: PriceAdjustType;
  markupValue?: number;
  productCount: number;
  onMarkupChange: (type?: PriceAdjustType, value?: number) => void;
  onCommitToBasePrices: (products: MetaShopProduct[]) => void;
  products: MetaShopProduct[];
  showStrikethroughPrice?: boolean;
  onShowStrikethroughChange?: (val: boolean) => void;
  onRevertAllToBase?: () => void;
  onClearTemporaryMarkup?: () => void;
  hasTemporaryShopMarkup?: boolean;
  hasDriftedProducts?: boolean;
  priceMarkupHistory?: MetaShopPriceMarkupHistoryEntry[];
  onClearHistory?: () => void;
}

export const MetaShopBulkPriceMarkupPanel: React.FC<ShopBulkProps> = ({
  T, markupType, markupValue, productCount, onMarkupChange, onCommitToBasePrices, products,
  showStrikethroughPrice = true, onShowStrikethroughChange,
  onRevertAllToBase, onClearTemporaryMarkup, hasTemporaryShopMarkup, hasDriftedProducts,
  priceMarkupHistory = [], onClearHistory,
}) => {
  const hasAdjust = !!markupType && markupValue != null && markupValue !== 0;
  const isDecrease = hasAdjust && (markupValue ?? 0) < 0;

  const applyToBase = () => {
    if (!markupType || markupValue == null || markupValue === 0) {
      alert(T ? 'ابتدا نوع و مقدار تغییر را وارد کنید (مثلاً 10- برای ۱۰٪ تخفیف).' : 'Set adjustment type and value (e.g. -10 for 10% off).');
      return;
    }
    const absVal = Math.abs(markupValue!);
    const unit = markupType === 'percent' ? (T ? '٪' : '%') : '';
    if (!window.confirm(
      T
        ? `قیمت پایه ${productCount} محصول ${isDecrease ? 'کاهش' : 'افزایش'} ${absVal}${unit} یابد؟ این عمل قابل بازگشت خودکار نیست.`
        : `${isDecrease ? 'Decrease' : 'Increase'} base prices of ${productCount} products by ${absVal}${unit}? This cannot be auto-undone.`,
    )) return;
    onCommitToBasePrices(commitMarkupToProducts(products, markupType, markupValue!));
    onMarkupChange(undefined, undefined);
  };

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3 mb-4">
      <div>
        <p className="text-sm font-bold text-sky-900">{T ? 'تغییر قیمت تجمیعی (همه محصولات)' : 'Bulk price adjustment (all products)'}</p>
        <p className="text-[11px] text-sky-700/90 mt-0.5">
          {T
            ? 'عدد مثبت = افزایش، عدد منفی = کاهش/تخفیف (مثلاً -10 یعنی ۱۰٪ کمتر). موقت یا ثبت در قیمت پایه.'
            : 'Positive = increase, negative = decrease (e.g. -10 = 10% off). Temporary or commit to base prices.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ['none', T ? 'بدون تغییر' : 'None'],
          ['percent', T ? 'درصدی ٪' : 'Percent %'],
          ['amount', T ? 'مبلغ ثابت' : 'Fixed amount'],
        ] as const).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              if (type === 'none') onMarkupChange(undefined, undefined);
              else onMarkupChange(type, markupValue ?? (type === 'percent' ? -10 : -1000));
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              (type === 'none' && !markupType) || markupType === type
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {markupType && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="max-w-[140px]">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              {markupType === 'percent' ? (T ? 'درصد (+/-)' : 'Percent (+/-)') : (T ? 'مبلغ (+/-)' : 'Amount (+/-)')}
            </label>
            <input
              type="number"
              step="any"
              className={fld + ' dir-ltr'}
              placeholder={markupType === 'percent' ? (T ? 'مثلاً -10' : 'e.g. -10') : (T ? 'مثلاً -5000' : 'e.g. -5000')}
              value={markupValue ?? ''}
              onChange={e => onMarkupChange(markupType, e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          {markupType === 'percent' && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {([-20, -10, -5, 5, 10, 20] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onMarkupChange('percent', n)}
                  className={`text-[10px] px-2 py-1 rounded-full border ${
                    markupValue === n ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'
                  }`}
                >
                  {n > 0 ? `+${n}%` : `${n}%`}
                </button>
              ))}
            </div>
          )}
          {hasAdjust && (
            <p className="text-[11px] text-sky-800 pb-2">
              {T
                ? `→ ${isDecrease ? 'کاهش' : 'افزایش'} روی ${productCount} محصول`
                : `→ ${isDecrease ? 'decrease' : 'increase'} on ${productCount} products`}
            </p>
          )}
        </div>
      )}
      {hasAdjust && productCount > 0 && (
        <button
          type="button"
          onClick={applyToBase}
          className="text-xs px-3 py-2 rounded-lg border border-sky-300 bg-white text-sky-800 hover:bg-sky-100 font-semibold"
        >
          {T ? 'ثبت در قیمت پایه همه محصولات' : 'Commit to all base prices'}
        </button>
      )}
      {onShowStrikethroughChange && (
        <MetaShopStrikethroughToggle
          T={T}
          mode="shop"
          value={showStrikethroughPrice}
          onChange={onShowStrikethroughChange}
        />
      )}
      {(onRevertAllToBase || onClearTemporaryMarkup) && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-sky-200">
          {onClearTemporaryMarkup && hasTemporaryShopMarkup && (
            <button type="button" onClick={onClearTemporaryMarkup} className="text-xs px-3 py-2 rounded-lg border border-sky-300 bg-white text-sky-800 hover:bg-sky-100">
              {T ? 'لغو تغییر موقت (بدون تغییر قیمت پایه)' : 'Clear temporary adjustment'}
            </button>
          )}
          {onRevertAllToBase && (hasDriftedProducts || hasTemporaryShopMarkup) && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(T ? 'همه محصولات به قیمت پایه برگردند؟ تخفیف‌ها و تغییرات موقت هم پاک می‌شود.' : 'Revert all products to base prices? Temporary discounts/markups will be cleared.')) return;
                onRevertAllToBase();
              }}
              className="text-xs px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 font-semibold"
            >
              {T ? '↺ برگشت همه به قیمت پایه' : '↺ Revert all to base prices'}
            </button>
          )}
        </div>
      )}
      {priceMarkupHistory.length > 0 && (
        <div className="border-t border-sky-200 pt-3 mt-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-sky-900">{T ? 'تاریخچه تغییر قیمت / سود' : 'Price markup history'}</p>
            {onClearHistory && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(T ? 'تاریخچه پاک شود؟' : 'Clear history?')) return;
                  onClearHistory();
                }}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                {T ? 'پاک کردن' : 'Clear'}
              </button>
            )}
          </div>
          <ul className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {priceMarkupHistory.map(entry => (
              <li
                key={entry.id}
                className="text-[11px] text-sky-900/90 bg-white/70 border border-sky-100 rounded-lg px-2.5 py-1.5 leading-snug"
              >
                {formatPriceMarkupHistoryLine(entry, T)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface StrikethroughToggleProps {
  T: boolean;
  mode: 'shop' | 'product';
  value?: boolean;
  onChange: (val: boolean | undefined) => void;
}

export const MetaShopStrikethroughToggle: React.FC<StrikethroughToggleProps> = ({ T, mode, value, onChange }) => (
  <div className="border-t border-sky-200 pt-3 mt-1">
    <p className="text-xs font-semibold text-sky-900 mb-2">
      {T ? 'نمایش قیمت قبلی (خط‌خورده)' : 'Show previous price (strikethrough)'}
    </p>
    <p className="text-[10px] text-sky-700/90 mb-2">
      {T
        ? 'فقط وقتی قیمت نهایی از قیمت پایه کمتر باشد (تخفیف). برای افزایش قیمت خط‌خورده نمایش داده نمی‌شود.'
        : 'Only when the final price is below base (discount). Never shown for price increases.'}
    </p>
    <div className="flex flex-wrap gap-2">
      {mode === 'product' && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
            value == null ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          {T ? 'پیش‌فرض فروشگاه' : 'Shop default'}
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
          value === true ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200'
        }`}
      >
        {T ? 'بله — خط بخورد + درصد' : 'Yes — strikethrough + %'}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
          value === false ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200'
        }`}
      >
        {T ? 'خیر — فقط قیمت جدید' : 'No — new price only'}
      </button>
    </div>
  </div>
);

interface ProductMarkupProps {
  T: boolean;
  product: MetaShopProduct;
  onChange: (patch: Partial<MetaShopProduct>) => void;
  inheritsShop?: boolean;
}

export const MetaShopProductMarkupFields: React.FC<ProductMarkupProps> = ({ T, product, onChange, inheritsShop }) => (
  <div className="bg-sky-50/80 border border-sky-100 rounded-xl p-3 space-y-2">
    <p className="text-xs font-semibold text-sky-900">
      {T ? 'تغییر قیمت این محصول (+/-)' : 'Price adjustment for this product (+/-)'}
      {inheritsShop && !product.priceMarkupType && (
        <span className="font-normal text-sky-600 ms-1">({T ? 'از تنظیم تجمیعی فروشگاه' : 'inherits shop bulk'})</span>
      )}
    </p>
    <div className="flex flex-wrap gap-2">
      {([
        ['none', T ? 'پیش‌فرض فروشگاه' : 'Shop default'],
        ['percent', T ? 'درصدی ٪' : 'Percent %'],
        ['amount', T ? 'مبلغ' : 'Fixed'],
      ] as const).map(([type, label]) => (
        <button
          key={type}
          type="button"
          onClick={() => {
            if (type === 'none') onChange({ priceMarkupType: undefined, priceMarkupValue: undefined });
            else onChange({ priceMarkupType: type, priceMarkupValue: product.priceMarkupValue ?? (type === 'percent' ? -10 : -1000) });
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
            (type === 'none' && !product.priceMarkupType) || product.priceMarkupType === type
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
    {product.priceMarkupType && (
      <input
        type="number"
        step="any"
        className={fld + ' max-w-[140px] dir-ltr text-xs'}
        placeholder={product.priceMarkupType === 'percent' ? (T ? '-10' : '-10') : (T ? '-5000' : '-5000')}
        value={product.priceMarkupValue ?? ''}
        onChange={e => onChange({ priceMarkupValue: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    )}
    <MetaShopStrikethroughToggle
      T={T}
      mode="product"
      value={product.showStrikethroughPrice}
      onChange={val => onChange({ showStrikethroughPrice: val })}
    />
    {productHasPriceDrift(product) && (
      <button
        type="button"
        onClick={() => {
          if (!window.confirm(T ? 'این محصول به قیمت پایه برگردد؟' : 'Revert this product to base price?')) return;
          onChange(revertProductToBase(product));
        }}
        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 w-fit"
      >
        {T ? '↺ برگشت به قیمت پایه' : '↺ Revert to base'}
      </button>
    )}
  </div>
);

interface PromoLabelProps {
  T: boolean;
  product: MetaShopProduct;
  onChange: (patch: Partial<MetaShopProduct>) => void;
  onI18nChange?: (code: string, val: string) => void;
  translationLangs?: { code: string; name: string }[];
}

export const MetaShopProductPromoLabelField: React.FC<PromoLabelProps> = ({
  T, product, onChange, onI18nChange, translationLangs = [],
}) => (
  <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-3 space-y-2">
    <p className="text-xs font-semibold text-amber-900">{T ? 'برچسب تبلیغاتی محصول' : 'Product promo badge'}</p>
    <p className="text-[10px] text-amber-700/90">
      {T ? 'مثلا: عرض خاص، پیشنهاد ویژه، Best offer — روی کارت محصول در فروشگاه نمایش داده می‌شود.' : 'e.g. Special offer, Best offer — shown on the product card.'}
    </p>
    <div className="flex flex-wrap gap-1.5">
      {PROMO_LABEL_PRESETS_FA.map(preset => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange({ promoLabel: preset })}
          className={`text-[10px] px-2 py-1 rounded-full border ${
            product.promoLabel === preset
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
    <input
      className={fld + ' text-xs'}
      placeholder={T ? 'متن دلخواه...' : 'Custom text...'}
      value={product.promoLabel || ''}
      onChange={e => onChange({ promoLabel: e.target.value || undefined })}
    />
    {translationLangs.map(lg => (
      <div key={lg.code} className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-8 shrink-0">{lg.name}</span>
        <input
          className={fld + ' text-xs flex-1'}
          placeholder={T ? `برچسب (${lg.code})` : `Badge (${lg.code})`}
          value={product.i18n?.[lg.code]?.promoLabel || ''}
          onChange={e => onI18nChange?.(lg.code, e.target.value)}
        />
      </div>
    ))}
  </div>
);
