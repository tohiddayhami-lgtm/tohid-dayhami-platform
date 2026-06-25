import React from 'react';
import type { MetaverseHotspot, MetaShop, MetaShopProduct } from '../../types';
import { Language } from '../../App';
import { bi, videoEmbed, waLink, HOTSPOT_ICON, isRtlExpoLang } from './expoUtils';

interface Props {
  hotspot: MetaverseHotspot | null;
  shops: MetaShop[];
  lang: string;
  onClose: () => void;
  onOpenShop: (slug: string) => void;
}

// 2D overlay that renders the right content for a clicked hotspot. Anything that needs the
// full shop (order/company/product/page) deep-links into the existing public shop via onOpenShop.
export const HotspotModal: React.FC<Props> = ({ hotspot, shops, lang, onClose, onOpenShop }) => {
  if (!hotspot) return null;
  const T = isRtlExpoLang(lang);
  const h = hotspot;
  const shop = h.shopSlug ? shops.find(s => s.slug === h.shopSlug) : undefined;
  const product: MetaShopProduct | undefined = shop && h.productRef ? shop.products.find(p => p.id === h.productRef) : undefined;
  const title = bi(h.title, lang, '') || (shop?.name) || (HOTSPOT_ICON[h.type] || '');
  const body = bi(h.body, lang, '');

  const t = {
    close: T ? 'بستن' : 'Close',
    openShop: T ? 'ورود به فروشگاه' : 'Open shop',
    order: T ? 'ثبت سفارش' : 'Place order',
    visit: T ? 'مشاهده وب‌سایت' : 'Visit website',
    openPdf: T ? 'باز کردن کاتالوگ (PDF)' : 'Open catalog (PDF)',
    whatsapp: T ? 'گفتگو در واتس‌اپ' : 'Chat on WhatsApp',
    call: T ? 'تماس' : 'Call',
    email: T ? 'ایمیل' : 'Email',
    noShop: T ? 'فروشگاه مرتبط یافت نشد.' : 'No linked shop found.',
  };

  const primaryBtn = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors';
  const ghostBtn = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors';

  const Body = () => {
    switch (h.type) {
      case 'video': {
        const v = h.url ? videoEmbed(h.url) : null;
        if (!v) return <p className="text-sm text-gray-500">{T ? 'لینک ویدئو نامعتبر است.' : 'Invalid video link.'}</p>;
        return (
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
            {v.kind === 'iframe'
              ? <iframe src={v.src} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={title} />
              : <video src={v.src} controls autoPlay className="w-full h-full" />}
          </div>
        );
      }
      case 'image':
        return h.url ? <img src={h.url} alt={title} className="w-full max-h-[60vh] object-contain rounded-xl" /> : null;
      case 'pdf':
        return (
          <div className="space-y-3">
            <div className="w-full h-[55vh] rounded-xl overflow-hidden border border-gray-200">
              {h.url && <iframe src={h.url} className="w-full h-full" title={title} />}
            </div>
            {h.url && <a href={h.url} target="_blank" rel="noreferrer" className={primaryBtn}>{t.openPdf}</a>}
          </div>
        );
      case 'product':
        return (
          <div className="space-y-3">
            {product?.images?.[0] && <img src={product.images[0]} alt={product.name} className="w-full max-h-72 object-cover rounded-xl" />}
            <h4 className="font-bold text-gray-800">{product?.name || title}</h4>
            {(product?.description || body) && <p className="text-sm text-gray-600 whitespace-pre-line">{product?.description || body}</p>}
            {product?.price ? <div className="text-indigo-600 font-bold">{(product.currency || shop?.currency || '')} {product.price.toLocaleString()}</div> : null}
            {shop && <button onClick={() => onOpenShop(shop.slug)} className={primaryBtn}>{t.order} →</button>}
          </div>
        );
      case 'company':
      case 'page':
      case 'order':
        return (
          <div className="space-y-3">
            {shop?.logo && <img src={shop.logo} alt={shop.name} className="h-16 object-contain" />}
            {shop?.coverImage && <img src={shop.coverImage} alt={shop.name} className="w-full max-h-44 object-cover rounded-xl" />}
            <p className="text-sm text-gray-600 whitespace-pre-line">{body || shop?.subtitle || shop?.title || ''}</p>
            {shop
              ? <button onClick={() => onOpenShop(shop.slug)} className={primaryBtn}>{h.type === 'order' ? t.order : t.openShop} →</button>
              : <p className="text-sm text-gray-500">{t.noShop}</p>}
          </div>
        );
      case 'whatsapp':
        return (
          <div className="space-y-3">
            {body && <p className="text-sm text-gray-600 whitespace-pre-line">{body}</p>}
            <a href={waLink(h.whatsapp || h.phone || '')} target="_blank" rel="noreferrer" className={primaryBtn} style={{ background: '#25D366' }}>{t.whatsapp}</a>
          </div>
        );
      case 'contact':
        return (
          <div className="space-y-3">
            {body && <p className="text-sm text-gray-600 whitespace-pre-line">{body}</p>}
            <div className="flex flex-wrap gap-2">
              {h.phone && <a href={`tel:${h.phone}`} className={ghostBtn} dir="ltr">📞 {h.phone}</a>}
              {h.whatsapp && <a href={waLink(h.whatsapp)} target="_blank" rel="noreferrer" className={ghostBtn}>💬 {t.whatsapp}</a>}
              {h.email && <a href={`mailto:${h.email}`} className={ghostBtn} dir="ltr">✉️ {h.email}</a>}
            </div>
          </div>
        );
      case 'url':
      default:
        return (
          <div className="space-y-3">
            {body && <p className="text-sm text-gray-600 whitespace-pre-line">{body}</p>}
            {h.url && <a href={h.url} target="_blank" rel="noreferrer" className={primaryBtn}>{t.visit} →</a>}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" dir={T ? 'rtl' : 'ltr'} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-5 animate-fade-in" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <span>{h.icon || HOTSPOT_ICON[h.type]}</span>{title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
        </div>
        <Body />
      </div>
    </div>
  );
};
