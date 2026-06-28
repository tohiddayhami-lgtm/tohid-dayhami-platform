import React, { useState, useRef, useMemo } from 'react';
import { MetaShopProduct, MetaShopLang, MetaShopType, MetaShopDirCat } from '../types';
import { Language } from '../App';
import { uploadFileWithProgress } from '../services/firebaseService';
import { DEFAULT_PRODUCT_LANGS, isRtlLang } from '../utils/metaShopLang';
import { newCustomerProduct, duplicateCustomerProduct } from '../utils/customerMetaShopAccess';
import { customerCategoriesList, categoryLabelFa } from '../utils/customerMetaShopCategories';
import { CustomerMetaShopCategoryManager } from './CustomerMetaShopCategoryManager';
import { CustomerMetaShopPriceSettings } from './CustomerMetaShopPriceSettings';
import { IconSearch, IconTrash, IconUpload, IconPlus, IconCopy } from './Icons';

interface Props {
  products: MetaShopProduct[];
  categories: (string | MetaShopDirCat)[];
  groupI18n: Record<string, Record<string, string>>;
  hidePrices?: boolean;
  hidePriceText?: string;
  currency: string;
  shopType?: MetaShopType;
  shopSlug: string;
  shopBaseUrl: string;
  shopLangs?: MetaShopLang[];
  lang: Language;
  loading?: boolean;
  saving?: boolean;
  saved?: boolean;
  onProductsChange: (products: MetaShopProduct[]) => void;
  onCategoriesChange: (categories: (string | MetaShopDirCat)[], groupI18n: Record<string, Record<string, string>>, products: MetaShopProduct[]) => void;
  onPriceSettingsChange?: (patch: { hidePrices?: boolean; hidePriceText?: string }) => void;
  onSave: () => void;
}

export const CustomerMetaShopProductsEditor: React.FC<Props> = ({
  products, categories, groupI18n, hidePrices, hidePriceText, currency, shopType, shopSlug, shopBaseUrl, shopLangs = [], lang,
  loading, saving, saved, onProductsChange, onCategoriesChange, onPriceSettingsChange, onSave,
}) => {
  const T = lang === 'fa';
  const isRealEstate = shopType === 'realestate';
  const shopPricesHidden = !!hidePrices;
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const catList = useMemo(() => customerCategoriesList(categories, groupI18n), [categories, groupI18n]);

  const translationLangs = useMemo(() => {
    const configured = shopLangs.filter(l => l.code?.trim());
    const list = configured.length ? configured : DEFAULT_PRODUCT_LANGS;
    return list.filter(l => l.code !== 'fa');
  }, [shopLangs]);

  const updProductI18n = (id: string, code: string, field: 'name' | 'description', value: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const i18n = { ...(p.i18n || {}) };
    i18n[code] = { ...(i18n[code] || {}), [field]: value };
    updProduct(id, { i18n });
  };

  const productI18nField = (p: MetaShopProduct, code: string, field: 'name' | 'description'): string =>
    p.i18n?.[code]?.[field] || '';

  const filtered = useMemo(() => {
    let list = products;
    if (catFilter) list = list.filter(p => p.group === catFilter);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.group || '').toLowerCase().includes(q),
    );
  }, [products, search, catFilter]);

  const updProduct = (id: string, patch: Partial<MetaShopProduct>) => {
    onProductsChange(products.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  const uploadImg = (file: File, onUrl: (url: string) => void) => {
    uploadFileWithProgress(file, () => {}, onUrl, e => alert(e.message), 'images');
  };

  const addImages = (id: string, files: FileList | null) => {
    if (!files?.length) return;
    const product = products.find(p => p.id === id);
    if (!product) return;
    const pending = Array.from(files);
    let done = 0;
    const urls: string[] = [];
    pending.forEach(f => {
      uploadImg(f, url => {
        urls.push(url);
        done += 1;
        if (done === pending.length) {
          updProduct(id, { images: [...(product.images || []), ...urls] });
        }
      });
    });
  };

  const removeImage = (id: string, index: number) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    updProduct(id, { images: (p.images || []).filter((_, i) => i !== index) });
  };

  const addNewProduct = () => {
    const p = newCustomerProduct(currency, shopType, lang);
    if (catFilter) p.group = catFilter;
    onProductsChange([p, ...products]);
    setExpandedId(p.id);
    setSearch('');
  };

  const duplicateProduct = (source: MetaShopProduct) => {
    const p = duplicateCustomerProduct(source, lang);
    const idx = products.findIndex(x => x.id === source.id);
    const next = [...products];
    next.splice(idx + 1, 0, p);
    onProductsChange(next);
    setExpandedId(p.id);
  };

  const categoryPicker = (p: MetaShopProduct) => (
    <div className="space-y-2">
      <label className={lbl}>{T ? 'دسته محصول' : 'Category'}</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updProduct(p.id, { group: undefined, subcategory: undefined })}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !p.group ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          {T ? 'بدون دسته' : 'None'}
        </button>
        {catList.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => updProduct(p.id, { group: c.key })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              p.group === c.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
            }`}
          >
            {categoryLabelFa(c, lang)}
          </button>
        ))}
      </div>
      {catList.length === 0 && (
        <p className="text-[11px] text-gray-400">{T ? '↑ اول از بخش بالا یک دسته بسازید' : '↑ Create a category above first'}</p>
      )}
      {p.group && (
        <div>
          <label className={lbl}>{T ? 'زیردسته (اختیاری)' : 'Subcategory (optional)'}</label>
          <input
            className={fld}
            placeholder={T ? 'مثلاً: درجه یک، صادراتی…' : 'e.g. Grade A, export…'}
            value={p.subcategory || ''}
            onChange={e => updProduct(p.id, { subcategory: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );

  const saveBar = (
    <div className="sticky bottom-0 bg-white/95 backdrop-blur border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm z-10">
      <span className="text-xs text-gray-400">{T ? 'تغییرات را ذخیره کنید تا در فروشگاه اعمال شود' : 'Save to apply changes to your shop'}</span>
      <button type="button" onClick={onSave} disabled={saving} className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 shrink-0">
        {saving ? '...' : saved ? (T ? 'ذخیره شد ✓' : 'Saved ✓') : (T ? 'ذخیره' : 'Save')}
      </button>
    </div>
  );

  const categorySection = (
    <CustomerMetaShopCategoryManager
      categories={categories}
      groupI18n={groupI18n}
      products={products}
      lang={lang}
      activeFilter={catFilter}
      onFilterChange={setCatFilter}
      onCategoriesChange={onCategoriesChange}
    />
  );

  const priceSettingsSection = !isRealEstate && onPriceSettingsChange ? (
    <CustomerMetaShopPriceSettings
      hidePrices={!!hidePrices}
      hidePriceText={hidePriceText}
      lang={lang}
      onChange={onPriceSettingsChange}
    />
  ) : null;

  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-16 text-center text-gray-400 text-sm animate-pulse">
        {T ? 'در حال بارگذاری محصولات…' : 'Loading products…'}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        {priceSettingsSection}
        {categorySection}
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center space-y-4">
          <p className="text-gray-400 text-sm">{T ? 'هنوز محصولی ندارید.' : 'No products yet.'}</p>
          <button type="button" onClick={addNewProduct} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
            <IconPlus className="w-4 h-4" />
            {T ? 'افزودن اولین محصول' : 'Add your first product'}
          </button>
        </div>
        {saveBar}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {priceSettingsSection}
      {categorySection}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addNewProduct}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shrink-0"
        >
          <IconPlus className="w-4 h-4" />
          {T ? 'محصول جدید' : 'New product'}
        </button>
        <div className="relative flex-1 min-w-[180px]">
        <IconSearch className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
        <input
          className={fld + ' ps-9'}
          placeholder={T ? 'جستجو نام، کد یا توضیحات…' : 'Search name, SKU or description…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {T
          ? `${filtered.length} محصول — قیمت‌ها به ${currency} — روی هر کدام کلیک کنید`
          : `${filtered.length} product(s) — prices in ${currency} — tap to edit`}
      </p>

      <div className="space-y-2">
        {filtered.map(p => {
          const open = expandedId === p.id;
          const thumb = p.images?.[0];
          const productUrl = `${shopBaseUrl}?shop=${encodeURIComponent(shopSlug)}&product=${encodeURIComponent(p.id)}`;
          return (
            <div key={p.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : p.id)}
                className="w-full flex items-center gap-3 p-3 text-start hover:bg-gray-50/80 transition-colors"
              >
                {thumb ? (
                  <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-dashed border-gray-200 bg-gray-50 shrink-0 flex items-center justify-center text-[9px] text-gray-300">
                    {T ? 'بدون عکس' : 'No photo'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800 truncate">{p.name}</div>
                  <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5">
                    {p.group && (
                      <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {catList.find(c => c.key === p.group) ? categoryLabelFa(catList.find(c => c.key === p.group)!, lang) : p.group}
                        {p.subcategory ? ` · ${p.subcategory}` : ''}
                      </span>
                    )}
                    {p.hidePrice || shopPricesHidden ? (
                      <span className="text-emerald-600">{T ? 'قابل مذاکره' : 'Negotiable'}</span>
                    ) : p.price != null ? (
                      <span>{currency} {p.price.toLocaleString()}</span>
                    ) : null}
                    {(p.images?.length ?? 0) > 0 && <span>{p.images!.length} {T ? 'عکس' : 'photo(s)'}</span>}
                    {p.outOfStock && <span className="text-red-500">{T ? 'ناموجود' : 'Out of stock'}</span>}
                  </div>
                </div>
                <span className="text-gray-400 text-xs shrink-0 w-4 text-center">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-4">
                  {/* Images */}
                  <div>
                    <label className={lbl}>{T ? 'عکس‌های محصول' : 'Product photos'}</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(p.images || []).map((url, i) => (
                        <div key={i} className="relative group">
                          <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => removeImage(p.id, i)}
                            className="absolute -top-1.5 -end-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-90 hover:opacity-100 shadow"
                            title={T ? 'حذف عکس' : 'Remove'}
                          >
                            <IconTrash className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileRefs.current[p.id]?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <IconPlus className="w-5 h-5" />
                        <span className="text-[9px] font-medium">{T ? 'افزودن' : 'Add'}</span>
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={el => { fileRefs.current[p.id] = el; }}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={e => { addImages(p.id, e.target.files); e.target.value = ''; }}
                    />
                    <p className="text-[10px] text-gray-400">{T ? 'چند عکس همزمان انتخاب کنید' : 'You can select multiple photos at once'}</p>
                  </div>

                  {categoryPicker(p)}

                  <div>
                    <label className={lbl}>{T ? 'نام محصول (فارسی / پیش‌فرض)' : 'Product name (default)'}</label>
                    <input className={fld} value={p.name} onChange={e => updProduct(p.id, { name: e.target.value })} />
                  </div>

                  <div>
                    <label className={lbl}>{T ? 'توضیحات (فارسی / پیش‌فرض)' : 'Description (default)'}</label>
                    <textarea
                      className={fld + ' min-h-[100px] resize-y'}
                      placeholder={T ? 'توضیحات محصول را بنویسید…' : 'Write product description…'}
                      value={p.description || ''}
                      onChange={e => updProduct(p.id, { description: e.target.value })}
                    />
                  </div>

                  {translationLangs.length > 0 && (
                    <div className="space-y-3 p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                      <p className="text-xs font-semibold text-violet-800">{T ? 'ترجمه به زبان‌های دیگر' : 'Translations'}</p>
                      {translationLangs.map(lg => (
                        <div key={lg.code} className="space-y-2 pb-2 border-b border-violet-100 last:border-0 last:pb-0">
                          <p className="text-[11px] font-bold text-violet-600">{lg.name || lg.code}</p>
                          <input
                            className={fld + ' text-sm' + (!isRtlLang(lg.code, translationLangs) ? ' dir-ltr' : '')}
                            placeholder={T ? `نام به ${lg.name || lg.code}` : `Name in ${lg.name || lg.code}`}
                            value={productI18nField(p, lg.code, 'name')}
                            onChange={e => updProductI18n(p.id, lg.code, 'name', e.target.value)}
                          />
                          <textarea
                            className={fld + ' min-h-[60px] text-sm resize-y' + (!isRtlLang(lg.code, translationLangs) ? ' dir-ltr' : '')}
                            placeholder={T ? `توضیحات به ${lg.name || lg.code}` : `Description in ${lg.name || lg.code}`}
                            value={productI18nField(p, lg.code, 'description')}
                            onChange={e => updProductI18n(p.id, lg.code, 'description', e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(p.priceOptions?.length ?? 0) > 0 ? (
                      <div className="sm:col-span-2 space-y-2">
                        <p className="text-xs font-semibold text-gray-600">{T ? 'قیمت / نرخ‌ها' : 'Prices / rates'}</p>
                        {p.priceOptions!.map(opt => (
                          <div key={opt.id} className="flex items-center gap-2 flex-wrap bg-gray-50 rounded-lg p-2">
                            <span className="text-xs text-gray-600 flex-1 min-w-[80px]">{opt.label}</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              className={fld + ' dir-ltr max-w-[140px]'}
                              disabled={p.hidePrice || shopPricesHidden}
                              value={opt.price ?? ''}
                              onChange={e => {
                                const price = e.target.value === '' ? 0 : Number(e.target.value);
                                updProduct(p.id, {
                                  priceOptions: p.priceOptions!.map(o => o.id === opt.id ? { ...o, price } : o),
                                });
                              }}
                            />
                            <span className="text-[10px] text-gray-400">{opt.currency || currency}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <label className={lbl}>{T ? 'قیمت' : 'Price'} ({currency})</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className={fld + ' dir-ltr'}
                          disabled={p.hidePrice || shopPricesHidden}
                          value={p.price ?? ''}
                          onChange={e => updProduct(p.id, { price: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </div>
                    )}
                    {p.packPrice != null && (
                      <div>
                        <label className={lbl}>{T ? 'قیمت بسته' : 'Pack price'}</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className={fld + ' dir-ltr'}
                          value={p.packPrice ?? ''}
                          onChange={e => updProduct(p.id, { packPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  {!shopPricesHidden && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!p.hidePrice}
                      onChange={e => updProduct(p.id, { hidePrice: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-600">{T ? 'فقط این محصول: قیمت نمایش داده نشود (قابل مذاکره)' : 'This product only: hide price (negotiable)'}</span>
                  </label>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!p.outOfStock}
                      onChange={e => updProduct(p.id, { outOfStock: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-600">{T ? 'ناموجود — مشتری نمی‌تواند سفارش دهد' : 'Out of stock — customers cannot order'}</span>
                  </label>

                  {/* Product-level discount */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">{T ? 'تخفیف روی این محصول' : 'Discount on this product'}</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['none', T ? 'بدون تخفیف' : 'None'],
                        ['percent', T ? 'درصدی ٪' : 'Percent %'],
                        ['amount', T ? 'مبلغی' : 'Fixed amount'],
                      ] as const).map(([type, label]) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            if (type === 'none') updProduct(p.id, { discountType: undefined, discountValue: undefined });
                            else updProduct(p.id, { discountType: type, discountValue: p.discountValue ?? 10 });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            (type === 'none' && !p.discountType) || p.discountType === type
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {p.discountType && (
                      <input
                        type="number"
                        min={0}
                        className={fld + ' dir-ltr max-w-[140px]'}
                        placeholder={p.discountType === 'percent' ? '10' : '5000'}
                        value={p.discountValue ?? ''}
                        onChange={e => updProduct(p.id, { discountValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                    )}
                  </div>

                  <a href={productUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline inline-block">
                    {T ? '← مشاهده در فروشگاه' : 'View in shop →'}
                  </a>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => duplicateProduct(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700"
                    >
                      <IconCopy className="w-3.5 h-3.5" />
                      {T ? 'کپی این محصول' : 'Duplicate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {saveBar}
    </div>
  );
};
