import React, { useState } from 'react';
import type { MetaShop, MetaShopProduct } from '../types';
import {
  INCOTERM_PRESETS,
  applyIncotermsToProducts,
  applyOriginToProducts,
  clearIncotermsFromProducts,
  clearOriginFromProducts,
  normalizeIncoterms,
  toggleIncoterm,
} from '../utils/metaShopExportTerms';

const fld = 'w-full px-2 py-1.5 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
const chip = (on: boolean) =>
  `px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
    on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
  }`;

interface BulkProps {
  T: boolean;
  productCount: number;
  products: MetaShopProduct[];
  defaultIncoterms?: string[];
  defaultOrigin?: MetaShop['defaultOrigin'];
  onProductsChange: (products: MetaShopProduct[]) => void;
  onDefaultsChange: (patch: { defaultIncoterms?: string[]; defaultOrigin?: MetaShop['defaultOrigin'] }) => void;
}

export const MetaShopBulkExportTermsPanel: React.FC<BulkProps> = ({
  T, productCount, products, defaultIncoterms, defaultOrigin, onProductsChange, onDefaultsChange,
}) => {
  const [bulkTerms, setBulkTerms] = useState<string[]>(() => normalizeIncoterms(defaultIncoterms));
  const [customTerm, setCustomTerm] = useState('');
  const [originName, setOriginName] = useState(defaultOrigin?.name || '');
  const [originFlag, setOriginFlag] = useState(defaultOrigin?.flagUrl || '');
  const [emptyOnlyIncoterms, setEmptyOnlyIncoterms] = useState(false);
  const [emptyOnlyOrigin, setEmptyOnlyOrigin] = useState(false);

  const applyIncoterms = () => {
    const terms = normalizeIncoterms(bulkTerms);
    if (!terms.length) {
      alert(T ? 'حداقل یک ترم (مثلاً FOB) انتخاب کنید.' : 'Select at least one term (e.g. FOB).');
      return;
    }
    if (!window.confirm(
      T
        ? `ترم‌های ${terms.join(', ')} روی ${emptyOnlyIncoterms ? 'محصولات بدون ترم' : 'همه محصولات'} اعمال شود؟`
        : `Apply ${terms.join(', ')} to ${emptyOnlyIncoterms ? 'products without terms' : 'all products'}?`,
    )) return;
    onProductsChange(applyIncotermsToProducts(products, terms, { emptyOnly: emptyOnlyIncoterms }));
    onDefaultsChange({ defaultIncoterms: terms });
  };

  const applyOrigin = () => {
    const name = originName.trim();
    if (!name) {
      alert(T ? 'نام مبدأ را وارد کنید (مثلاً Iran).' : 'Enter origin name (e.g. Iran).');
      return;
    }
    const origin = { name, flagUrl: originFlag.trim() || undefined };
    if (!window.confirm(
      T
        ? `مبدأ «${name}» روی ${emptyOnlyOrigin ? 'محصولات بدون مبدأ' : 'همه محصولات'} اعمال شود؟`
        : `Apply origin «${name}» to ${emptyOnlyOrigin ? 'products without origin' : 'all products'}?`,
    )) return;
    onProductsChange(applyOriginToProducts(products, origin, emptyOnlyOrigin));
    onDefaultsChange({ defaultOrigin: origin });
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4 mb-4">
      <div>
        <p className="text-sm font-bold text-emerald-900">{T ? 'ترم‌های قراردادی صادراتی (Incoterms) — تجمیعی' : 'Export contract terms (Incoterms) — bulk'}</p>
        <p className="text-[11px] text-emerald-800/90 mt-0.5">
          {T ? 'اختیاری — EXW, FOB, CIF, DDP و… روی همه یا محصولات خالی. بعداً هر محصول جداگانه قابل ویرایش است.' : 'Optional — apply EXW, FOB, CIF, DDP to all or empty-only products. Edit per product later.'}
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{T ? 'ترم‌ها' : 'Terms'}</label>
        <div className="flex flex-wrap gap-1.5">
          {INCOTERM_PRESETS.map(term => (
            <button
              key={term}
              type="button"
              className={chip(bulkTerms.includes(term))}
              onClick={() => setBulkTerms(prev => toggleIncoterm(prev, term))}
            >
              {term}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2">
          <input
            className={fld + ' flex-1 dir-ltr text-xs max-w-[140px]'}
            placeholder={T ? 'ترم دلخواه' : 'Custom term'}
            value={customTerm}
            onChange={e => setCustomTerm(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (customTerm.trim()) {
                  setBulkTerms(prev => toggleIncoterm(prev, customTerm));
                  setCustomTerm('');
                }
              }
            }}
          />
          <button
            type="button"
            disabled={!customTerm.trim()}
            onClick={() => { setBulkTerms(prev => toggleIncoterm(prev, customTerm)); setCustomTerm(''); }}
            className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:border-emerald-300 disabled:opacity-40"
          >
            +
          </button>
        </div>
        {bulkTerms.length > 0 && (
          <p className="text-[10px] text-emerald-700 mt-1 dir-ltr">{bulkTerms.join(' · ')}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <input type="checkbox" className="accent-emerald-600" checked={emptyOnlyIncoterms} onChange={e => setEmptyOnlyIncoterms(e.target.checked)} />
          {T ? 'فقط محصولات بدون ترم' : 'Only products without terms'}
        </label>
        <button type="button" onClick={applyIncoterms} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
          {T ? `اعمال روی ${productCount} محصول` : `Apply to ${productCount} products`}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(T ? 'ترم‌های همه محصولات پاک شود؟' : 'Clear incoterms on all products?')) return;
            onProductsChange(clearIncotermsFromProducts(products));
            onDefaultsChange({ defaultIncoterms: undefined });
            setBulkTerms([]);
          }}
          className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
        >
          {T ? 'پاک کردن همه' : 'Clear all'}
        </button>
      </div>

      <div className="border-t border-emerald-200 pt-3">
        <p className="text-sm font-bold text-emerald-900 mb-1">{T ? 'مبدأ کالا (Origin) — تجمیعی' : 'Product origin — bulk'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <input className={fld} placeholder={T ? 'مبدأ (مثلاً Iran / ایران)' : 'Origin (e.g. Iran)'} value={originName} onChange={e => setOriginName(e.target.value)} />
          <input className={fld + ' dir-ltr'} placeholder={T ? 'لینک پرچم (اختیاری)' : 'Flag URL (optional)'} value={originFlag} onChange={e => setOriginFlag(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <input type="checkbox" className="accent-emerald-600" checked={emptyOnlyOrigin} onChange={e => setEmptyOnlyOrigin(e.target.checked)} />
            {T ? 'فقط محصولات بدون مبدأ' : 'Only products without origin'}
          </label>
          <button type="button" onClick={applyOrigin} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            {T ? 'اعمال مبدأ' : 'Apply origin'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(T ? 'مبدأ همه محصولات پاک شود؟' : 'Clear origin on all products?')) return;
              onProductsChange(clearOriginFromProducts(products));
              onDefaultsChange({ defaultOrigin: undefined });
              setOriginName('');
              setOriginFlag('');
            }}
            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
          >
            {T ? 'پاک کردن مبدأ' : 'Clear origin'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ProductProps {
  T: boolean;
  product: MetaShopProduct;
  onChange: (patch: Partial<MetaShopProduct>) => void;
}

export const MetaShopProductExportFields: React.FC<ProductProps> = ({ T, product, onChange }) => {
  const [customTerm, setCustomTerm] = useState('');
  const terms = normalizeIncoterms(product.incoterms);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      <div>
        <label className="text-[11px] font-bold text-gray-600">{T ? 'ترم‌های قراردادی (اختیاری)' : 'Contract terms (optional)'}</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {INCOTERM_PRESETS.map(term => (
            <button
              key={term}
              type="button"
              className={chip(terms.includes(term))}
              onClick={() => onChange({ incoterms: toggleIncoterm(terms, term) })}
            >
              {term}
            </button>
          ))}
          <input
            className="px-1.5 py-0.5 rounded border border-gray-200 text-[10px] dir-ltr w-16 outline-none focus:border-emerald-400"
            placeholder="+"
            value={customTerm}
            onChange={e => setCustomTerm(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (customTerm.trim()) {
                  onChange({ incoterms: toggleIncoterm(terms, customTerm) });
                  setCustomTerm('');
                }
              }
            }}
          />
        </div>
        {terms.length > 0 && (
          <button type="button" onClick={() => onChange({ incoterms: undefined })} className="text-[10px] text-red-400 mt-0.5 hover:text-red-600">
            {T ? 'پاک کردن ترم‌ها' : 'Clear terms'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={fld + ' text-xs'}
          placeholder={T ? 'مبدأ کالا (اختیاری)' : 'Origin (optional)'}
          value={product.origin?.name || ''}
          onChange={e => {
            const name = e.target.value;
            onChange({ origin: name.trim() ? { name, flagUrl: product.origin?.flagUrl } : undefined });
          }}
        />
        <input
          className={fld + ' text-xs dir-ltr'}
          placeholder={T ? 'لینک پرچم' : 'Flag URL'}
          value={product.origin?.flagUrl || ''}
          onChange={e => {
            const flagUrl = e.target.value.trim() || undefined;
            const name = product.origin?.name?.trim();
            onChange({ origin: name ? { name, flagUrl } : undefined });
          }}
        />
      </div>
    </div>
  );
};
