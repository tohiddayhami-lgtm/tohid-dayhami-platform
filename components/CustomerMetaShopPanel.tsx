import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { MetaShop, MetaShopOrder, MetaShopProduct, MetaShopDiscount, MetaShopDirCat, CustomerAccount } from '../types';
import { Language } from '../App';
import { uploadFileWithProgress } from '../services/firebaseService';
import { pickCustomerEditableFields } from '../utils/customerMetaShopAccess';
import { seedCustomerCategories } from '../utils/customerMetaShopCategories';
import { MetaShopOrderDetailCard } from './MetaShopOrderDetailCard';
import { CustomerMetaShopProductsEditor } from './CustomerMetaShopProductsEditor';
import { CustomerMetaShopDiscountsEditor } from './CustomerMetaShopDiscountsEditor';
import { CustomerMetaShopLocaleEditor } from './CustomerMetaShopLocaleEditor';
import { IconGlobe, IconTrash, IconUpload, IconTag } from './Icons';
import { shopNeedsProductHydration } from '../utils/metaShopChunks';
import { sumOrderCommissions } from '../utils/metaShopCommission';
import { clearCustomerMetaShopNav, loadCustomerMetaShopNav, saveCustomerMetaShopNav } from '../utils/metaShopPanelSession';

interface Props {
  shops: MetaShop[];
  orders: MetaShopOrder[];
  shopBaseUrl: string;
  lang: Language;
  customerUser?: CustomerAccount;
  onSave: (shopId: string, edits: Partial<MetaShop>) => Promise<void>;
  onLoadShop?: (shopId: string) => Promise<MetaShop>;
  onUpdateOrder?: (orderId: string, updates: Partial<MetaShopOrder>) => Promise<void>;
  soundEnabled?: boolean;
  onSoundEnabledChange?: (enabled: boolean) => void;
}

type Tab = 'info' | 'locale' | 'products' | 'discounts' | 'orders';

export const CustomerMetaShopPanel: React.FC<Props> = ({
  shops, orders, shopBaseUrl, lang, customerUser, onSave, onLoadShop,
  onUpdateOrder, soundEnabled = true, onSoundEnabledChange,
}) => {
  const T = lang === 'fa';
  const userId = customerUser?.id || '';
  const savedNav = loadCustomerMetaShopNav(userId);
  const [selectedShopId, setSelectedShopId] = useState(() => {
    if (savedNav?.shopId && shops.some(s => s.id === savedNav.shopId)) return savedNav.shopId;
    return shops[0]?.id || '';
  });
  const [tab, setTab] = useState<Tab>(() => savedNav?.tab || 'info');
  const [draft, setDraft] = useState<Partial<MetaShop>>({});
  const [productsDraft, setProductsDraft] = useState<MetaShopProduct[]>([]);
  const [categoriesDraft, setCategoriesDraft] = useState<(string | MetaShopDirCat)[]>([]);
  const [groupI18nDraft, setGroupI18nDraft] = useState<Record<string, Record<string, string>>>({});
  const [discountsDraft, setDiscountsDraft] = useState<MetaShopDiscount[]>([]);
  const [loadedShop, setLoadedShop] = useState<MetaShop | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const seoRef = useRef<HTMLInputElement>(null);

  const shop = shops.find(s => s.id === selectedShopId) || loadedShop;

  useEffect(() => {
    if (!selectedShopId) return;
    saveCustomerMetaShopNav(userId, {
      shopId: selectedShopId,
      tab,
      portalTab: 'metashop',
    });
  }, [userId, selectedShopId, tab]);

  useEffect(() => {
    if (!selectedShopId) return;
    if (!shops.some(s => s.id === selectedShopId)) {
      const fallback = shops[0]?.id || '';
      setSelectedShopId(fallback);
      if (!fallback) clearCustomerMetaShopNav(userId);
    }
  }, [shops, selectedShopId, userId]);
  const shopOrders = useMemo(
    () => orders.filter(o => o.shopId === selectedShopId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, selectedShopId],
  );
  const commissionTotal = useMemo(
    () => sumOrderCommissions(shopOrders, customerUser ? [customerUser] : []),
    [shopOrders, customerUser],
  );
  const commissionPct = customerUser?.commissionPercent ?? 0;
  const newOrderCount = useMemo(
    () => orders.filter(o => (customerUser?.metaShopIds || []).includes(o.shopId) && o.status === 'new').length,
    [orders, customerUser?.metaShopIds],
  );

  const handleStatusChange = async (orderId: string, status: MetaShopOrder['status']) => {
    if (!onUpdateOrder) return;
    setUpdatingOrderId(orderId);
    try {
      await onUpdateOrder(orderId, { status });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleMarkReceived = async (orderId: string) => {
    await handleStatusChange(orderId, 'in_progress');
  };

  const applyCatalog = useCallback((full: MetaShop) => {
    const prods = full.products || [];
    const seeded = seedCustomerCategories(full, prods);
    setLoadedShop(full);
    setProductsDraft(prods);
    setCategoriesDraft(seeded.categories);
    setGroupI18nDraft(seeded.groupI18n);
    setDiscountsDraft(full.discounts || []);
  }, []);

  const loadCatalog = useCallback(async (shopId: string, force = false) => {
    const base = shops.find(s => s.id === shopId);
    if (!base) return;
    const needsLoad = force || shopNeedsProductHydration(base) || (base.discounts === undefined && (base.productCount ?? 0) > 0);
    if (!needsLoad && (base.products?.length || !base.productCount)) {
      applyCatalog(base);
      return;
    }
    if (!onLoadShop) {
      applyCatalog(base);
      return;
    }
    setLoadingCatalog(true);
    try {
      const full = await onLoadShop(shopId);
      applyCatalog(full);
    } finally {
      setLoadingCatalog(false);
    }
  }, [shops, onLoadShop, applyCatalog]);

  useEffect(() => {
    const s = shops.find(x => x.id === selectedShopId);
    if (s) {
      setDraft(pickCustomerEditableFields(s));
      setLoadedShop(null);
      setProductsDraft([]);
      setCategoriesDraft([]);
      setGroupI18nDraft({});
      setDiscountsDraft(s.discounts || []);
    }
  }, [selectedShopId, shops]);

  useEffect(() => {
    if ((tab === 'products' || tab === 'discounts') && selectedShopId) {
      loadCatalog(selectedShopId);
    }
  }, [tab, selectedShopId, loadCatalog]);

  const upd = (patch: Partial<MetaShop>) => {
    setDraft(d => ({ ...d, ...patch }));
    setSaved(false);
  };

  const uploadImg = (file: File, onUrl: (url: string) => void) => {
    uploadFileWithProgress(file, () => {}, onUrl, e => alert(e.message), 'images');
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSaveInfo = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      await onSave(shop.id, draft);
      flashSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProducts = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      await onSave(shop.id, {
        products: productsDraft,
        categories: categoriesDraft,
        groupI18n: groupI18nDraft,
        hidePrices: draft.hidePrices,
        hidePriceText: draft.hidePriceText,
        priceMarkupType: draft.priceMarkupType,
        priceMarkupValue: draft.priceMarkupValue,
        showStrikethroughPrice: draft.showStrikethroughPrice,
        productImageFit: draft.productImageFit,
      });
      setLoadedShop(prev => prev ? {
        ...prev,
        products: productsDraft,
        productCount: productsDraft.length,
        categories: categoriesDraft,
        groupI18n: groupI18nDraft,
        hidePrices: draft.hidePrices,
        hidePriceText: draft.hidePriceText,
        priceMarkupType: draft.priceMarkupType,
        priceMarkupValue: draft.priceMarkupValue,
        showStrikethroughPrice: draft.showStrikethroughPrice,
        productImageFit: draft.productImageFit,
      } : prev);
      flashSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleCategoriesChange = (
    categories: (string | MetaShopDirCat)[],
    groupI18n: Record<string, Record<string, string>>,
    products: MetaShopProduct[],
  ) => {
    setCategoriesDraft(categories);
    setGroupI18nDraft(groupI18n);
    setProductsDraft(products);
    setSaved(false);
  };

  const handleProductsChange = (products: MetaShopProduct[]) => {
    setProductsDraft(products);
    setSaved(false);
  };

  const handlePriceSettingsChange = (patch: {
    hidePrices?: boolean;
    hidePriceText?: string;
    showStrikethroughPrice?: boolean;
    productImageFit?: 'cover' | 'contain';
    priceMarkupType?: import('../types').MetaShop['priceMarkupType'];
    priceMarkupValue?: number;
  }) => {
    upd(patch);
  };

  const handleSaveDiscounts = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      await onSave(shop.id, { discounts: discountsDraft });
      flashSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocale = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      const localePatch: Partial<MetaShop> = {
        currency: draft.currency,
        displayCurrencies: draft.displayCurrencies,
        defaultDisplayCurrency: draft.defaultDisplayCurrency,
        defaultLang: draft.defaultLang,
        languages: draft.languages,
        i18n: draft.i18n,
        title: draft.title,
        subtitle: draft.subtitle,
        collectionText: draft.collectionText,
      };
      await onSave(shop.id, localePatch);
      setLoadedShop(prev => prev ? {
        ...prev,
        currency: localePatch.currency ?? prev.currency,
        displayCurrencies: localePatch.displayCurrencies ?? prev.displayCurrencies,
        defaultDisplayCurrency: localePatch.defaultDisplayCurrency ?? prev.defaultDisplayCurrency,
        defaultLang: localePatch.defaultLang ?? prev.defaultLang,
        languages: localePatch.languages ?? prev.languages,
        i18n: localePatch.i18n ?? prev.i18n,
        title: localePatch.title ?? prev.title,
        subtitle: localePatch.subtitle ?? prev.subtitle,
        collectionText: localePatch.collectionText ?? prev.collectionText,
      } : prev);
      flashSaved();
    } finally {
      setSaving(false);
    }
  };

  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-800 transition-colors bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  const tabBtn = (id: Tab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="ms-1 bg-amber-500 text-white rounded-full px-1.5 text-[10px]">{badge}</span>
      )}
    </button>
  );

  if (shops.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400 text-sm">
        {T ? 'فروشگاه MetaShop به این حساب متصل نشده است.' : 'No MetaShop assigned to this account.'}
      </div>
    );
  }

  const shopBaseCurrency = (draft.currency || shop?.currency || loadedShop?.currency || 'USD').trim().toUpperCase();
  const productCount = loadedShop?.productCount ?? shop?.productCount ?? productsDraft.length;
  const shopLangs = draft.languages?.length
    ? draft.languages
    : (loadedShop?.languages || shop?.languages || []);

  return (
    <div className="space-y-4 animate-fade-in">
      {shops.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {shops.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setSelectedShopId(s.id); setTab('info'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedShopId === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {tabBtn('info', T ? 'اطلاعات فروشگاه' : 'Shop info')}
        {tabBtn('locale', T ? 'زبان و ارز' : 'Language & currency')}
        {tabBtn('products', T ? `محصولات (${productCount})` : `Products (${productCount})`)}
        {tabBtn('discounts', T ? 'کدهای تخفیف' : 'Discount codes')}
        {tabBtn('orders', T ? 'سفارش‌ها' : 'Orders', shopOrders.filter(o => o.status === 'new').length)}
        {shop && (
          <a href={`${shopBaseUrl}?shop=${encodeURIComponent(shop.slug)}`} target="_blank" rel="noreferrer" className="ms-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            <IconGlobe className="w-3.5 h-3.5" />{T ? 'مشاهده فروشگاه' : 'View shop'}
          </a>
        )}
      </div>

      {tab === 'locale' && shop && (
        <CustomerMetaShopLocaleEditor
          shop={loadedShop || shop}
          draft={draft}
          lang={lang}
          saving={saving}
          saved={saved}
          onChange={patch => { upd(patch); }}
          onSave={handleSaveLocale}
        />
      )}

      {tab === 'products' && shop && (
        <CustomerMetaShopProductsEditor
          products={productsDraft}
          categories={categoriesDraft}
          groupI18n={groupI18nDraft}
          hidePrices={draft.hidePrices}
          hidePriceText={draft.hidePriceText}
          showStrikethroughPrice={draft.showStrikethroughPrice}
          productImageFit={draft.productImageFit}
          priceMarkupType={draft.priceMarkupType}
          priceMarkupValue={draft.priceMarkupValue}
          currency={shopBaseCurrency}
          shopType={shop.type}
          shopSlug={shop.slug}
          shopBaseUrl={shopBaseUrl}
          shopLangs={shopLangs}
          lang={lang}
          loading={loadingCatalog}
          saving={saving}
          saved={saved}
          onProductsChange={handleProductsChange}
          onCategoriesChange={handleCategoriesChange}
          onPriceSettingsChange={handlePriceSettingsChange}
          onSave={handleSaveProducts}
        />
      )}

      {tab === 'discounts' && shop && (
        <CustomerMetaShopDiscountsEditor
          discounts={discountsDraft}
          currency={shopBaseCurrency}
          lang={lang}
          saving={saving}
          saved={saved}
          onChange={setDiscountsDraft}
          onSave={handleSaveDiscounts}
        />
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {newOrderCount > 0 && (
              <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="animate-pulse">🔔</span>
                {T
                  ? `${newOrderCount} سفارش جدید در انتظار دریافت`
                  : `${newOrderCount} new order(s) awaiting receipt`}
              </div>
            )}
            {onSoundEnabledChange && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer ms-auto">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={e => onSoundEnabledChange(e.target.checked)}
                  className="rounded border-gray-300"
                />
                {T ? 'بوق اعلان سفارش' : 'Order alert sound'}
              </label>
            )}
          </div>
          {commissionPct > 0 && shopOrders.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-900">
              <div className="font-semibold">{T ? 'خلاصه کمیسیون همکاری' : 'Commission summary'}</div>
              <p className="text-xs text-violet-700 mt-1">
                {T
                  ? `نرخ تعریف‌شده: ${commissionPct}% — جمع کمیسیون سفارش‌های این فروشگاه: ${shopOrders[0]?.currency || shop?.currency || ''} ${commissionTotal.toLocaleString()}`
                  : `Rate: ${commissionPct}% — total commission for this shop: ${shopOrders[0]?.currency || shop?.currency || ''} ${commissionTotal.toLocaleString()}`}
              </p>
            </div>
          )}
          {shopOrders.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400 text-sm">
              {T ? 'سفارشی ثبت نشده است.' : 'No orders yet.'}
            </div>
          ) : shopOrders.map(o => (
            <MetaShopOrderDetailCard
              key={o.id}
              order={o}
              shop={loadedShop || shop}
              shopBaseUrl={shopBaseUrl}
              lang={lang}
              commissionView="partner"
              partnerCommissionPercent={commissionPct}
              onStatusChange={
                onUpdateOrder
                  ? status => { if (updatingOrderId !== o.id) void handleStatusChange(o.id, status); }
                  : undefined
              }
              statusChangeDisabled={updatingOrderId === o.id}
              onMarkReceived={
                onUpdateOrder && o.status === 'new'
                  ? () => { if (updatingOrderId !== o.id) void handleMarkReceived(o.id); }
                  : undefined
              }
              markReceivedBusy={updatingOrderId === o.id}
            />
          ))}
        </div>
      )}

      {tab === 'info' && shop && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>{T ? 'تصویر کاور' : 'Cover image'}</label>
              <div className="flex items-center gap-2 flex-wrap">
                {draft.coverImage && <img src={draft.coverImage} alt="" className="w-20 h-14 object-cover rounded border" />}
                <button type="button" onClick={() => coverRef.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1 hover:bg-gray-50">
                  <IconUpload className="w-3.5 h-3.5" />{T ? 'آپلود' : 'Upload'}
                </button>
                {draft.coverImage && (
                  <button type="button" onClick={() => upd({ coverImage: '' })} className="text-red-400 p-1"><IconTrash className="w-4 h-4" /></button>
                )}
                <input type="file" ref={coverRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ coverImage: url })); e.target.value = ''; }} />
              </div>
              <input className={fld + ' dir-ltr text-xs mt-2'} placeholder={T ? 'یا لینک تصویر' : 'Or image URL'} value={draft.coverImage || ''} onChange={e => upd({ coverImage: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>{T ? 'لوگو' : 'Logo'}</label>
              <div className="flex items-center gap-2 flex-wrap">
                {draft.logo && <img src={draft.logo} alt="" className="w-14 h-14 object-contain rounded border bg-white p-1" />}
                <button type="button" onClick={() => logoRef.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1 hover:bg-gray-50">
                  <IconUpload className="w-3.5 h-3.5" />{T ? 'آپلود' : 'Upload'}
                </button>
                {draft.logo && (
                  <button type="button" onClick={() => upd({ logo: '' })} className="text-red-400 p-1"><IconTrash className="w-4 h-4" /></button>
                )}
                <input type="file" ref={logoRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ logo: url })); e.target.value = ''; }} />
              </div>
              <input className={fld + ' dir-ltr text-xs mt-2'} placeholder={T ? 'یا لینک لوگو' : 'Or logo URL'} value={draft.logo || ''} onChange={e => upd({ logo: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{T ? 'عنوان' : 'Title'}</label>
              <input className={fld} value={draft.title || ''} onChange={e => upd({ title: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>{T ? 'زیرعنوان' : 'Subtitle'}</label>
              <input className={fld} value={draft.subtitle || ''} onChange={e => upd({ subtitle: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={lbl}>{T ? 'متن مجموعه / هیرو' : 'Collection text'}</label>
              <input className={fld} value={draft.collectionText || ''} onChange={e => upd({ collectionText: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{T ? 'تلفن' : 'Phone'}</label>
              <input className={fld + ' dir-ltr'} value={draft.phone || ''} onChange={e => upd({ phone: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>WhatsApp</label>
              <input className={fld + ' dir-ltr'} value={draft.whatsapp || ''} onChange={e => upd({ whatsapp: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>{T ? 'ایمیل' : 'Email'}</label>
              <input className={fld + ' dir-ltr'} value={draft.email || ''} onChange={e => upd({ email: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>{T ? 'وب‌سایت' : 'Website'}</label>
              <input className={fld + ' dir-ltr'} value={draft.website || ''} onChange={e => upd({ website: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={lbl}>{T ? 'آدرس' : 'Address'}</label>
              <input className={fld} value={draft.address || ''} onChange={e => upd({ address: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={lbl}>{T ? 'متن فوتر' : 'Footer text'}</label>
              <textarea className={fld + ' min-h-[60px]'} value={draft.footerText || ''} onChange={e => upd({ footerText: e.target.value })} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1"><IconTag className="w-3.5 h-3.5" />{T ? 'اشتراک‌گذاری (SEO)' : 'Share preview (SEO)'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>{T ? 'عنوان لینک' : 'Link title'}</label>
                <input className={fld} value={draft.seoTitle || ''} onChange={e => upd({ seoTitle: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>{T ? 'توضیح لینک' : 'Link description'}</label>
                <input className={fld} value={draft.seoDescription || ''} onChange={e => upd({ seoDescription: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>{T ? 'تصویر اشتراک‌گذاری' : 'Share image'}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {draft.seoImage && <img src={draft.seoImage} alt="" className="w-14 h-14 object-cover rounded border" />}
                  <button type="button" onClick={() => seoRef.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1 hover:bg-gray-50">
                    <IconUpload className="w-3.5 h-3.5" />{T ? 'آپلود' : 'Upload'}
                  </button>
                  <input type="file" ref={seoRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, url => upd({ seoImage: url })); e.target.value = ''; }} />
                </div>
                <input className={fld + ' dir-ltr text-xs mt-2'} value={draft.seoImage || ''} onChange={e => upd({ seoImage: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleSaveInfo} disabled={saving} className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50">
              {saving ? '...' : saved ? (T ? 'ذخیره شد ✓' : 'Saved ✓') : (T ? 'ذخیره تغییرات' : 'Save changes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
