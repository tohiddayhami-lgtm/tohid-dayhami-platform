import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MetaShop, MetaShopProduct } from '../types';
import { shopCodeOf } from './shopCode';
import { Language } from '../App';
import { resolveShopLanguages, isRtlLang, localeForLang, legacyBilingual, translateField, translateStockLabel, uiString, resolveHidePriceLabel } from '../utils/metaShopLang';
import { normalizeShopCategories, categoryLabel, findCategoryEntry, translateProductGroup, translateProductSubcategory } from '../utils/metaShopCategories';
import { shopDisplayCurrencies, formatShopAmount, readViewCurrencyFromUrl, writeViewCurrencyToUrl, shopBaseCurrency } from '../utils/metaShopCurrency';
import { realEstateCardSummary, realEstateDetailRows, dealTypeLabel, propertyTypeLabel } from '../utils/metaShopRealEstate';
import { productPurchaseOptions } from '../utils/metaShopPriceTiers';

interface Props {
  shop: MetaShop;
  lang: Language;
  autoPrint?: boolean; // when reached via ?catalog=1 — opens the browser print dialog once images are ready
}

// Products per A4 page. Real-estate cards need room for full specs → 2 per page (1 row × 2 cols).
const perPageFor = (re: boolean) => (re ? 2 : 4);
// TOC rows per A4 page — conservative count so the last row never sits under the page footer.
const TOC_PER_PAGE = 13;

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const STR: Record<string, Record<string, string>> = {
  en: {
    productCatalog: 'Product Catalog', serviceCatalog: 'Service Catalog', propertyCatalog: 'Property Catalog', items: 'products', services: 'services', properties: 'properties',
    issued: 'Issued', sku: 'SKU', moq: 'MOQ', pack: 'Pack', origin: 'Origin', requestQuote: 'Price on request', negotiable: 'Negotiable',
    index: 'Table of Contents', page: 'Page', thankYou: 'Thank you for your interest',
    thankYouSub: 'We look forward to serving you. Scan the code below to open the live catalog and place your order online.',
    scanToOrder: 'Scan to view & order online', phone: 'Phone', email: 'Email', website: 'Website', address: 'Address',
    downloadPdf: 'Download PDF', backToShop: 'Back to shop', preparing: 'Preparing your catalog…',
    printHint: 'In the print dialog, choose “Save as PDF”.', pages: 'pages', item: 'No.', items_col: 'items',
    visitShop: 'Visit online shop', whatsapp: 'WhatsApp',
  },
  fa: {
    productCatalog: 'کاتالوگ محصولات', serviceCatalog: 'کاتالوگ خدمات', propertyCatalog: 'کاتالوگ املاک', items: 'محصول', services: 'خدمت', properties: 'ملک',
    issued: 'تاریخ صدور', sku: 'کد کالا', moq: 'حداقل سفارش', pack: 'بسته', origin: 'مبدأ', requestQuote: 'استعلام قیمت', negotiable: 'قابل مذاکره',
    index: 'فهرست مطالب', page: 'صفحه', thankYou: 'از توجه شما سپاسگزاریم',
    thankYouSub: 'مشتاق همکاری با شما هستیم. برای مشاهده کاتالوگ آنلاین و ثبت سفارش، کد زیر را اسکن کنید.',
    scanToOrder: 'برای مشاهده و سفارش آنلاین اسکن کنید', phone: 'تلفن', email: 'ایمیل', website: 'وب‌سایت', address: 'نشانی',
    downloadPdf: 'دانلود PDF', backToShop: 'بازگشت به فروشگاه', preparing: 'در حال آماده‌سازی کاتالوگ…',
    printHint: 'در پنجره چاپ، گزینه‌ی «ذخیره به‌صورت PDF» را انتخاب کنید.', pages: 'صفحه', item: 'ردیف', items_col: 'مورد',
    visitShop: 'ورود به فروشگاه آنلاین', whatsapp: 'واتس‌اپ',
  },
  ar: {
    productCatalog: 'كتالوج المنتجات', serviceCatalog: 'كتالوج الخدمات', propertyCatalog: 'كتالوج العقارات', items: 'منتج', services: 'خدمة', properties: 'عقار',
    issued: 'تاريخ الإصدار', sku: 'رمز SKU', moq: 'الحد الأدنى', pack: 'عبوة', origin: 'المنشأ', requestQuote: 'اطلب عرض سعر', negotiable: 'قابل للتفاوض',
    index: 'جدول المحتويات', page: 'صفحة', thankYou: 'شكراً لاهتمامكم',
    thankYouSub: 'نتطلع للتعاون معكم. امسح الرمز أدناه لعرض الكتالوج وتقديم الطلب عبر الإنترنت.',
    scanToOrder: 'امسح للعرض والطلب عبر الإنترنت', phone: 'الهاتف', email: 'البريد', website: 'الموقع', address: 'العنوان',
    downloadPdf: 'تحميل PDF', backToShop: 'العودة للمتجر', preparing: 'جارٍ تجهيز الكتالوج…',
    printHint: 'في نافذة الطباعة، اختر «حفظ كـ PDF».', pages: 'صفحات', item: 'م', items_col: 'بند',
    visitShop: 'الدخول إلى المتجر الإلكتروني', whatsapp: 'واتساب',
  },
};

export const MetaShopCatalog: React.FC<Props> = ({ shop, lang, autoPrint }) => {
  const isServices = shop.type === 'services';
  const isRealEstate = shop.type === 'realestate';
  const theme = shop.theme;

  // ── Languages — whatever is configured on the shop ──
  const langsList = resolveShopLanguages(shop);
  const isRtl = (code: string) => isRtlLang(code, langsList);
  const initialLang = (() => {
    try { const q = new URLSearchParams(window.location.search).get('lang'); if (q && langsList.find(l => l.code === q)) return q; } catch {}
    const preferred = shop.defaultLang || langsList[0]?.code || lang;
    return langsList.some(l => l.code === preferred) ? preferred : (langsList[0]?.code || lang);
  })();
  const [uiLang, setUiLang] = useState<string>(initialLang);
  const displayCurrencies = useMemo(() => shopDisplayCurrencies(shop), [shop]);
  const [viewCur, setViewCur] = useState(() => readViewCurrencyFromUrl(shop));
  useEffect(() => { setViewCur(readViewCurrencyFromUrl(shop)); }, [shop.id, shop.currency, shop.defaultDisplayCurrency]);
  const pickViewCurrency = (code: string) => { setViewCur(code); writeViewCurrencyToUrl(code); };

  const dir: 'rtl' | 'ltr' = isRtl(uiLang) ? 'rtl' : 'ltr';
  const locale = localeForLang(uiLang);
  const s = (k: string): string => uiString(STR, uiLang, k);

  const L = (faVal?: string, enVal?: string) => legacyBilingual(uiLang, faVal, enVal);
  const TR = (i18n: Record<string, Record<string, string>> | undefined, key: string, legacy: string) =>
    translateField(i18n, key, legacy, uiLang);
  const pName = (p: MetaShopProduct) => TR(p.i18n, 'name', p.name);
  const pDesc = (p: MetaShopProduct) => TR(p.i18n, 'description', p.description || '');
  const pStock = (p: MetaShopProduct) => translateStockLabel(p.stockLabel, uiLang, p.i18n);
  const curOf = (p: MetaShopProduct, optCur?: string) =>
    (optCur?.trim()) || (p.currency?.trim()) || shop.currency;
  const money = (n?: number, sourceCur?: string) => {
    if (n == null) return '';
    return formatShopAmount(n, sourceCur || shop.currency, viewCur, shop);
  };

  const products = useMemo(() => (shop.products || []).filter(p => p.active !== false), [shop.products]);
  const pGroup = (p: MetaShopProduct) => translateProductGroup(shop, p.group || '', uiLang, p.i18n);
  const pSubcat = (p: MetaShopProduct) => translateProductSubcategory(p.subcategory || '', uiLang, p.i18n, products);

  // ── Group products by category (explicit order first, then discovered), keeping a flat fallback bucket ──
  const UNCAT = '__uncat__';
  const grouped = useMemo(() => {
    const map = new Map<string, MetaShopProduct[]>();
    const order: string[] = [];
    const catKeys = normalizeShopCategories(shop.categories, products);
    catKeys.forEach(c => { if (c && !map.has(c)) { map.set(c, []); order.push(c); } });
    products.forEach(p => {
      const g = (p.group && p.group.trim()) ? p.group : UNCAT;
      if (!map.has(g)) { map.set(g, []); order.push(g); }
      map.get(g)!.push(p);
    });
    return order
      .filter(c => (map.get(c) || []).length)
      .map(c => ({
        cat: c,
        label: c === UNCAT
          ? (isRealEstate ? s('properties') : isServices ? s('services') : s('items'))
          : categoryLabel(findCategoryEntry(shop.categories, c), uiLang, shop),
        items: map.get(c)!,
      }));
  }, [products, shop.categories, uiLang, isServices, isRealEstate, shop]);

  const perPage = perPageFor(isRealEstate);
  const showToc = grouped.length > 1 && products.length > perPage;
  const coverPages = 1;
  const tocPages = showToc ? Math.ceil(grouped.length / TOC_PER_PAGE) : 0;

  // ── Paginate each category into A4 pages; number items sequentially; record per-category start page for the TOC ──
  const { pages, tocPageChunks } = useMemo(() => {
    const pgs: { cat: string; label: string; items: MetaShopProduct[]; part: number; parts: number; startNo: number }[] = [];
    const tocEntries: { label: string; count: number; pageStart: number }[] = [];
    let globalNo = 0;
    const firstProductPrintNo = coverPages + tocPages + 1; // 1-based printed page index of the first product page
    grouped.forEach(g => {
      const parts = chunk(g.items, perPage);
      tocEntries.push({ label: g.label, count: g.items.length, pageStart: firstProductPrintNo + pgs.length });
      parts.forEach((items, i) => {
        pgs.push({ cat: g.cat, label: g.label, items, part: i, parts: parts.length, startNo: globalNo });
        globalNo += items.length;
      });
    });
    return { pages: pgs, tocPageChunks: chunk(tocEntries, TOC_PER_PAGE) };
  }, [grouped, tocPages, perPage]);

  const totalPages = coverPages + tocPages + pages.length + 1; // + back cover

  // ── Public links ──
  const shopLink = `${window.location.origin}${window.location.pathname}?shop=${encodeURIComponent(shop.slug)}&lang=${uiLang}${displayCurrencies.length > 1 && viewCur !== shopBaseCurrency(shop) ? `&cur=${encodeURIComponent(viewCur)}` : ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&qzone=1&data=${encodeURIComponent(shopLink)}`;

  // ── Dates ──
  const today = new Date();
  const dateStr = (() => { try { return today.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return today.toLocaleDateString(); } })();
  const yearStr = (() => { try { return today.toLocaleDateString(locale, { year: 'numeric' }); } catch { return String(today.getFullYear()); } })();

  // ── Nice default filename for "Save as PDF" ──
  useEffect(() => {
    const prev = document.title;
    document.title = `${shop.name} — ${isRealEstate ? s('propertyCatalog') : isServices ? s('serviceCatalog') : s('productCatalog')}`;
    return () => { document.title = prev; };
  }, [shop.name, uiLang, isRealEstate, isServices]);

  // ── Preload images, then (optionally) open the print dialog once everything is ready ──
  const [ready, setReady] = useState(false);
  const printedRef = useRef(false);
  useEffect(() => {
    const urls = new Set<string>();
    if (shop.coverImage) urls.add(shop.coverImage);
    if (shop.logo) urls.add(shop.logo);
    products.forEach(p => { if (p.images && p.images[0]) urls.add(p.images[0]); });
    urls.add(qrUrl);
    const list = [...urls];
    if (!list.length) { setReady(true); return; }
    let done = 0, finished = false;
    const finish = () => { if (!finished) { finished = true; setReady(true); } };
    const tick = () => { done++; if (done >= list.length) finish(); };
    list.forEach(u => { const im = new Image(); im.onload = tick; im.onerror = tick; im.src = u; });
    const to = setTimeout(finish, 6000); // never block forever on a slow/broken image
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && autoPrint && !printedRef.current) {
      printedRef.current = true;
      const id = setTimeout(() => { try { window.print(); } catch {} }, 600);
      return () => clearTimeout(id);
    }
  }, [ready, autoPrint]);

  const doPrint = () => { try { window.print(); } catch {} };
  const backToShop = () => { window.location.href = shopLink; };

  // ── CSS custom props from the shop theme ──
  const rootStyle = {
    ['--c-primary' as any]: theme.primary,
    ['--c-cover' as any]: theme.cover,
    ['--c-coverText' as any]: theme.coverText,
    ['--c-bg' as any]: theme.bg,
    ['--c-heading' as any]: theme.heading,
    ['--c-text' as any]: theme.text,
  } as React.CSSProperties;

  // Price hidden (per-product or shop-wide) → «قابل مذاکره» instead of any amount
  const priceHidden = (p: MetaShopProduct) => !!shop.hidePrices || !!p.hidePrice;

  // ── Price block ──
  const priceJsx = (p: MetaShopProduct) => {
    if (priceHidden(p)) return <div className="msc-price-neg">{resolveHidePriceLabel(uiLang, shop, p, s('negotiable'))}</div>;
    const opts = productPurchaseOptions(p, shop.type);
    if (opts.length) {
      return (
        <div className="msc-price-opts">
          {opts.slice(0, 4).map(o => (
            <span key={o.id} className="msc-price-opt"><b>{L(o.label, o.labelEn)}</b> {money(o.price, curOf(p, o.currency))}</span>
          ))}
        </div>
      );
    }
    if (p.price != null && p.price > 0) {
      return (
        <div className="msc-price-main">
          {money(p.price, curOf(p))}
          <span className="msc-price-unit">{p.priceUnit ? ` ${p.priceUnit}` : (p.unit ? ` / ${p.unit}` : '')}</span>
          {p.packPrice && !p.priceTiers?.length ? <span className="msc-price-pack"> · {s('pack')}: {money(p.packPrice, curOf(p))}</span> : null}
        </div>
      );
    }
    return <div className="msc-price-quote">{s('requestQuote')}</div>;
  };

  const metaBits = (p: MetaShopProduct): string[] => {
    const bits: string[] = [];
    if (!isServices && p.moq) bits.push(`${s('moq')}: ${p.moq}`);
    if (!isServices && p.pack != null) bits.push(`${s('pack')}: ${p.pack}${p.unit ? ' ' + p.unit : ''}`);
    const stock = pStock(p);
    if (stock) bits.push(stock);
    return bits;
  };

  const realEstateCard = (p: MetaShopProduct, no: number) => {
    const re = p.realEstate!;
    const img = p.images && p.images[0];
    const name = pName(p);
    const desc = pDesc(p);
    const summary = realEstateCardSummary(p, uiLang);
    const rows = realEstateDetailRows(p, uiLang);
    return (
      <article className="msc-prod msc-prod-re" key={p.id}>
        <div className="msc-prod-media">
          {img ? <img src={img} alt={name} /> : <div className="msc-noimg">{(name || '?').charAt(0)}</div>}
          <span className="msc-prod-no">{no}</span>
        </div>
        <div className="msc-prod-info">
          <h3 className="msc-prod-name">{name}</h3>
          <div className="msc-prod-tags">
            {p.sku && <span className="msc-tag">{s('sku')}: {p.sku}</span>}
            <span className="msc-tag">{dealTypeLabel(re.dealType, uiLang)}</span>
            <span className="msc-tag soft">{propertyTypeLabel(re.propertyType, uiLang)}</span>
          </div>
          {summary.length > 0 && (
            <div className="msc-re-chips">
              {summary.map((line, i) => <span key={i} className="msc-re-chip">{line}</span>)}
            </div>
          )}
          {desc && <p className="msc-prod-desc msc-re-desc">{desc}</p>}
          {rows.length > 0 && (
            <dl className="msc-re-specs">
              {rows.map((r, i) => (
                <div key={i} className="msc-re-spec-row">
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="msc-prod-bottom">
            <div className="msc-prod-price">{priceJsx(p)}</div>
          </div>
        </div>
      </article>
    );
  };

  const productCard = (p: MetaShopProduct, no: number) => {
    if (isRealEstate && p.realEstate) return realEstateCard(p, no);
    const img = p.images && p.images[0];
    const name = pName(p);
    const desc = pDesc(p);
    const feats = (p.features || []).filter(f => f.label || f.value).slice(0, 3);
    const meta = metaBits(p);
    return (
      <article className="msc-prod" key={p.id}>
        <div className="msc-prod-media">
          {img ? <img src={img} alt={name} /> : <div className="msc-noimg">{(name || '?').charAt(0)}</div>}
          <span className="msc-prod-no">{no}</span>
        </div>
        <div className="msc-prod-info">
          <h3 className="msc-prod-name">{name}</h3>
          <div className="msc-prod-tags">
            {p.sku && <span className="msc-tag">{s('sku')}: {p.sku}</span>}
            {p.hsCode && <span className="msc-tag">HS {p.hsCode}</span>}
            {p.subcategory && <span className="msc-tag soft">{pSubcat(p)}</span>}
            {p.origin?.name && (
              <span className="msc-tag origin">
                {p.origin.flagUrl && <img src={p.origin.flagUrl} alt="" />}{p.origin.name}
              </span>
            )}
          </div>
          {desc && <p className="msc-prod-desc">{desc}</p>}
          {feats.length > 0 && (
            <p className="msc-prod-specs">
              {feats.map((f, i) => <span key={i}><b>{f.label}:</b> {f.value}{i < feats.length - 1 ? '   ·   ' : ''}</span>)}
            </p>
          )}
          <div className="msc-prod-bottom">
            {meta.length > 0 && <div className="msc-prod-meta">{meta.join('  ·  ')}</div>}
            <div className="msc-prod-price">{priceJsx(p)}</div>
          </div>
        </div>
      </article>
    );
  };

  const coverTitle = TR(shop.i18n, 'title', shop.title || shop.name);
  const coverSub = TR(shop.i18n, 'subtitle', shop.subtitle || '');
  const coverEyebrow = TR(shop.i18n, 'collectionText', shop.collectionText || '');
  const footText = TR(shop.i18n, 'footerText', shop.footerText || '');
  const footAddress = TR(shop.i18n, 'address', shop.address || '');
  const heroStyle: React.CSSProperties = shop.coverImage
    ? { backgroundImage: `linear-gradient(155deg, rgba(0,0,0,.28), rgba(0,0,0,.62)), url(${shop.coverImage})` }
    : { background: `linear-gradient(150deg, ${theme.cover}, ${theme.primary})` };

  return (
    <div className="msc-root" dir={dir} style={rootStyle}>
      <style>{MSC_CSS}</style>

      {/* ── Screen toolbar (never printed) ── */}
      <div className="msc-toolbar msc-noprint">
        <div className="ttl">
          {shop.logo && <img src={shop.logo} alt="" className="msc-tb-logo" />}
          <span>{shop.name}</span>
          <span className="msc-tb-meta">· {totalPages} {s('pages')}</span>
        </div>
        {displayCurrencies.length > 1 && (
          <select className="msc-cur-select" dir="ltr" value={viewCur} onChange={e => pickViewCurrency(e.target.value)} aria-label="Currency">
            {displayCurrencies.map(dc => {
              const code = dc.code.trim().toUpperCase();
              return <option key={code} value={code}>{code}</option>;
            })}
          </select>
        )}
        {langsList.length > 1 && (
          <div className="msc-langsw">
            {langsList.map(lg => (
              <button key={lg.code} className={uiLang === lg.code ? 'on' : ''} onClick={() => setUiLang(lg.code)}>{lg.name}</button>
            ))}
          </div>
        )}
        <button className="msc-btn ghost" onClick={backToShop}>← {s('backToShop')}</button>
        <button className="msc-btn primary" onClick={doPrint} disabled={!ready}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          {s('downloadPdf')}
        </button>
        <span className="msc-tb-hint">{s('printHint')}</span>
      </div>

      {/* ── Preparing overlay while images load ── */}
      {!ready && (
        <div className="msc-prep msc-noprint">
          <div className="msc-spinner" />
          <p>{s('preparing')}</p>
        </div>
      )}

      <div className="msc-pages">
        {/* ════ COVER ════ */}
        <section className="msc-page msc-cover">
          <div className={`msc-cover-hero ${shop.coverImage ? 'has-img' : ''}`} style={heroStyle}>
            <div className="msc-cover-top">
              {shop.logo
                ? <span className="msc-cover-logo-plate"><img className="msc-cover-logo" src={shop.logo} alt={shop.name} /></span>
                : <span className="msc-cover-logo-txt">{shop.name}</span>}
              <span className="msc-cover-code">{shopCodeOf(shop)}</span>
            </div>
            <div className="msc-cover-center">
              {coverEyebrow && <p className="msc-cover-eyebrow">{coverEyebrow}</p>}
              <h1 className="msc-cover-title">{coverTitle}</h1>
              {coverSub && <p className="msc-cover-sub">{coverSub}</p>}
            </div>
            <div className="msc-cover-kind">{isRealEstate ? s('propertyCatalog') : isServices ? s('serviceCatalog') : s('productCatalog')} · {yearStr}</div>
          </div>
          <div className="msc-cover-foot">
            <div className="msc-cover-rule" />
            <div className="msc-cover-contact">
              {shop.phone && <div><span>{s('phone')}</span><b dir="ltr">{shop.phone}</b></div>}
              {shop.whatsapp && <div><span>{s('whatsapp')}</span><b dir="ltr">{shop.whatsapp}</b></div>}
              {shop.email && <div><span>{s('email')}</span><b dir="ltr">{shop.email}</b></div>}
              {shop.website && <div><span>{s('website')}</span><b dir="ltr">{shop.website}</b></div>}
              {footAddress && <div className="wide"><span>{s('address')}</span><b>{footAddress}</b></div>}
            </div>
            <div className="msc-cover-issue">
              <span>{s('issued')}: {dateStr}</span>
              <span>{products.length} {isRealEstate ? s('properties') : isServices ? s('services') : s('items')}</span>
            </div>
          </div>
        </section>

        {/* ════ TABLE OF CONTENTS (may span multiple A4 pages) ════ */}
        {showToc && tocPageChunks.map((tocChunk, tocIdx) => (
          <section className="msc-page msc-toc" key={`toc-${tocIdx}`}>
            <div className="msc-toc-head">
              <h2>
                {s('index')}
                {tocPageChunks.length > 1 && (
                  <span className="msc-toc-part"> ({tocIdx + 1}/{tocPageChunks.length})</span>
                )}
              </h2>
              <span>{coverTitle}</span>
            </div>
            <div className="msc-toc-body">
              <ul className="msc-toc-list">
                {tocChunk.map((e, i) => (
                  <li key={i}>
                    <span className="msc-toc-name">{e.label}</span>
                    <span className="msc-toc-count">{e.count} {s('items_col')}</span>
                    <span className="msc-toc-dots" />
                    <span className="msc-toc-pg">{e.pageStart}</span>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="msc-run-foot msc-toc-foot">
              <span>{shop.website || shop.name}</span>
              <span>{s('page')} {coverPages + tocIdx + 1} / {totalPages}</span>
            </footer>
          </section>
        ))}

        {/* ════ PRODUCT PAGES ════ */}
        {pages.map((pg, idx) => {
          const printNo = coverPages + tocPages + idx + 1;
          return (
            <section className="msc-page msc-catalog-page" key={idx}>
              <header className="msc-run-head">
                <div className="msc-run-brand">
                  {shop.logo && <img className="msc-run-logo" src={shop.logo} alt="" />}
                  <span className="msc-run-name">{coverTitle}</span>
                </div>
                <div className="msc-run-cat">{pg.label}{pg.parts > 1 ? ` (${pg.part + 1}/${pg.parts})` : ''}</div>
              </header>
              <div className={`msc-grid${isRealEstate ? ' msc-grid-re' : ''}`}>
                {pg.items.map((p, i) => productCard(p, pg.startNo + i + 1))}
              </div>
              <footer className="msc-run-foot">
                <span>{shop.website || shop.phone || shop.name}</span>
                <span>{s('page')} {printNo} / {totalPages}</span>
              </footer>
            </section>
          );
        })}

        {/* ════ BACK COVER ════ */}
        <section className="msc-page msc-back">
          <div className="msc-back-inner">
            {shop.logo
              ? <span className="msc-back-logo-plate"><img className="msc-back-logo" src={shop.logo} alt={shop.name} /></span>
              : <div className="msc-back-logo-txt">{shop.name}</div>}
            <h2 className="msc-back-title">{s('thankYou')}</h2>
            <p className="msc-back-sub">{footText || s('thankYouSub')}</p>
            <div className="msc-back-qr">
              <img src={qrUrl} alt="QR" />
              <span>{s('scanToOrder')}</span>
            </div>
            <div className="msc-back-contact">
              {shop.phone && <div><span>{s('phone')}</span><b dir="ltr">{shop.phone}</b></div>}
              {shop.whatsapp && <div><span>{s('whatsapp')}</span><b dir="ltr">{shop.whatsapp}</b></div>}
              {shop.email && <div><span>{s('email')}</span><b dir="ltr">{shop.email}</b></div>}
              {shop.website && <div><span>{s('website')}</span><b dir="ltr">{shop.website}</b></div>}
              {footAddress && <div className="wide"><span>{s('address')}</span><b>{footAddress}</b></div>}
            </div>
            <a className="msc-back-link" href={shopLink} target="_blank" rel="noreferrer">{s('visitShop')}</a>
          </div>
        </section>
      </div>
    </div>
  );
};

const MSC_CSS = `
.msc-root{ background:#525659; min-height:100vh; margin:0; font-family:'Vazirmatn',sans-serif; color:#111;
  --c-primary:#4f46e5; --c-cover:#1e293b; --c-coverText:#ffffff; --c-bg:#ffffff; --c-heading:#0f172a; --c-text:#334155;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.msc-root *{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* ── Toolbar ── */
.msc-toolbar{ position:sticky; top:0; z-index:60; display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  padding:9px 16px; background:rgba(17,24,39,.94); backdrop-filter:blur(10px); color:#fff; border-bottom:1px solid rgba(255,255,255,.08); }
.msc-toolbar .ttl{ display:flex; align-items:center; gap:8px; font-weight:800; font-size:13px; margin-inline-end:auto; }
.msc-tb-logo{ height:22px; width:auto; border-radius:5px; background:#fff; padding:2px; }
.msc-tb-meta{ font-weight:500; opacity:.6; font-size:11px; }
.msc-tb-hint{ font-size:11px; opacity:.65; width:100%; text-align:center; order:9; }
.msc-langsw{ display:flex; gap:2px; background:rgba(255,255,255,.1); border-radius:9px; padding:3px; }
.msc-langsw button{ border:none; background:transparent; color:#cbd5e1; font-family:inherit; font-size:12px; font-weight:700;
  padding:5px 11px; border-radius:6px; cursor:pointer; }
.msc-langsw button.on{ background:#fff; color:#111827; }
.msc-cur-select{ padding:6px 24px 6px 10px; font-size:12px; font-weight:700; font-family:inherit; border:1px solid rgba(255,255,255,.2);
  border-radius:9px; background:rgba(255,255,255,.08) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23cbd5e1' d='M1 1l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 8px center;
  color:#f8fafc; cursor:pointer; appearance:none; max-width:76px; }
.msc-btn{ border:none; cursor:pointer; font-family:inherit; font-weight:800; font-size:13px; padding:9px 16px; border-radius:10px;
  display:inline-flex; align-items:center; gap:7px; transition:transform .1s; }
.msc-btn:active{ transform:translateY(1px); }
.msc-btn.primary{ background:var(--c-primary); color:#fff; box-shadow:0 5px 16px rgba(0,0,0,.35); }
.msc-btn.primary:disabled{ opacity:.5; cursor:default; box-shadow:none; }
.msc-btn.ghost{ background:rgba(255,255,255,.12); color:#fff; }

/* ── Preparing overlay ── */
.msc-prep{ position:fixed; inset:0; z-index:55; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; background:rgba(40,42,46,.82); backdrop-filter:blur(3px); color:#e5e7eb; font-weight:700; font-size:14px; }
.msc-spinner{ width:38px; height:38px; border:4px solid rgba(255,255,255,.2); border-top-color:#fff; border-radius:50%; animation:msc-spin .8s linear infinite; }
@keyframes msc-spin{ to{ transform:rotate(360deg); } }

/* ── Pages frame ── */
.msc-pages{ display:flex; flex-direction:column; align-items:center; gap:10mm; padding:26px 12px 70px; }
/* Fixed (NOT min-) height so the on-screen preview lays out byte-for-byte like the printed/exported PDF —
   a growable preview hid overflow that the fixed-height PDF then clipped. */
.msc-page{ width:210mm; height:297mm; background:var(--c-bg); position:relative; overflow:hidden;
  box-shadow:0 8px 34px rgba(0,0,0,.34); display:flex; flex-direction:column; color:var(--c-text); }

/* ── Cover ── */
.msc-cover{ padding:0; }
.msc-cover-hero{ flex:0 0 186mm; height:186mm; background-size:cover; background-position:center; color:var(--c-coverText);
  position:relative; display:flex; flex-direction:column; padding:18mm 17mm; }
.msc-cover-top{ position:relative; display:flex; align-items:center; justify-content:center; min-height:26mm; }
.msc-cover-logo-plate{ display:inline-flex; align-items:center; justify-content:center; background:#fff; border-radius:4mm;
  padding:5mm 8mm; box-shadow:0 8px 26px rgba(0,0,0,.28); border:1px solid rgba(0,0,0,.06); max-width:120mm; }
.msc-cover-logo{ max-height:22mm; max-width:96mm; width:auto; object-fit:contain; display:block; }
.msc-cover-logo-txt{ font-size:23pt; font-weight:900; letter-spacing:.5px; text-align:center; background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.35); backdrop-filter:blur(5px); padding:4mm 8mm; border-radius:4mm; }
.msc-cover-code{ position:absolute; top:0; inset-inline-end:0; font-family:monospace; font-size:10pt; font-weight:700;
  letter-spacing:1px; color:#fff; background:rgba(0,0,0,.34); border:1px solid rgba(255,255,255,.4); padding:4px 10px;
  border-radius:8px; }
.msc-cover-center{ margin-top:auto; margin-bottom:auto; }
.msc-cover-eyebrow{ font-size:11pt; font-weight:700; letter-spacing:3px; text-transform:uppercase; opacity:.92; margin:0 0 10px; }
.msc-cover-title{ font-size:40pt; line-height:1.08; font-weight:900; margin:0; text-shadow:0 2px 14px rgba(0,0,0,.28);
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.msc-cover-sub{ font-size:14pt; font-weight:500; margin:14px 0 0; max-width:150mm; opacity:.95; line-height:1.5;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.msc-cover-kind{ font-size:11pt; font-weight:800; letter-spacing:2px; text-transform:uppercase; opacity:.9; }
.msc-cover-foot{ flex:1 1 auto; display:flex; flex-direction:column; padding:14mm 17mm; background:var(--c-bg); }
.msc-cover-rule{ height:4px; width:60mm; border-radius:4px; background:var(--c-primary); margin-bottom:12mm; }
.msc-cover-contact{ display:grid; grid-template-columns:1fr 1fr; gap:8mm 12mm; }
.msc-cover-contact .wide{ grid-column:1 / -1; }
.msc-cover-contact div{ display:flex; flex-direction:column; gap:3px; }
.msc-cover-contact span{ font-size:8.5pt; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--c-primary); }
.msc-cover-contact b{ font-size:12pt; font-weight:600; color:var(--c-heading); word-break:break-word; }
.msc-cover-issue{ margin-top:auto; display:flex; justify-content:space-between; font-size:10pt; color:var(--c-text); opacity:.75;
  border-top:1px solid rgba(0,0,0,.08); padding-top:6mm; }

/* ── Table of contents ── */
.msc-toc{ padding:18mm 18mm 14mm; display:flex; flex-direction:column; min-height:297mm; }
.msc-toc-head{ flex:none; display:flex; align-items:baseline; justify-content:space-between; border-bottom:3px solid var(--c-primary); padding-bottom:5mm; margin-bottom:6mm; }
.msc-toc-head h2{ font-size:26pt; font-weight:900; color:var(--c-heading); margin:0; }
.msc-toc-part{ font-size:16pt; font-weight:700; color:var(--c-primary); opacity:.85; }
.msc-toc-head span{ font-size:12pt; font-weight:600; color:var(--c-text); opacity:.7; }
.msc-toc-body{ flex:1 1 auto; min-height:0; display:flex; flex-direction:column; justify-content:flex-start; }
.msc-toc-list{ list-style:none; margin:0; padding:0 0 2mm; flex:none; display:flex; flex-direction:column; gap:0; }
.msc-toc-list li{ display:flex; align-items:center; gap:8px; padding:3.6mm 0; border-bottom:1px solid rgba(0,0,0,.07); font-size:12.5pt; line-height:1.25; }
.msc-toc-name{ font-weight:700; color:var(--c-heading); min-width:0; }
.msc-toc-count{ flex-shrink:0; font-size:9.5pt; font-weight:600; color:#fff; background:var(--c-primary); border-radius:20px; padding:2px 10px; opacity:.9; }
.msc-toc-dots{ flex:1; border-bottom:2px dotted rgba(0,0,0,.22); margin:0 4px; align-self:flex-end; transform:translateY(-4px); }
.msc-toc-pg{ flex-shrink:0; font-weight:800; color:var(--c-primary); font-size:13pt; min-width:10mm; text-align:center; }
.msc-toc-foot{ flex:none; margin-top:auto; padding-top:5mm; }

/* ── Running header / footer on product pages ── */
.msc-catalog-page{ padding:11mm 13mm 9mm; }
.msc-run-head{ display:flex; align-items:center; justify-content:space-between; gap:8mm; padding-bottom:4mm;
  border-bottom:2px solid var(--c-primary); margin-bottom:6mm; }
.msc-run-brand{ display:flex; align-items:center; gap:8px; min-width:0; }
.msc-run-logo{ height:9mm; width:auto; max-width:40mm; object-fit:contain; }
.msc-run-name{ font-size:11pt; font-weight:800; color:var(--c-heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.msc-run-cat{ font-size:10.5pt; font-weight:800; color:#fff; background:var(--c-primary); padding:4px 13px; border-radius:20px; white-space:nowrap; }
.msc-run-foot{ margin-top:auto; display:flex; align-items:center; justify-content:space-between; padding-top:4mm;
  border-top:1px solid rgba(0,0,0,.1); font-size:8.5pt; font-weight:600; color:var(--c-text); opacity:.7; }
.msc-run-foot span[dir]{ direction:ltr; }

/* ── Product grid + card (2 × 2 = 4 per page; large, uniform cards) ── */
.msc-grid{ flex:1; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:7mm; min-height:0; }
.msc-prod{ border:1px solid rgba(0,0,0,.12); border-radius:3.5mm; overflow:hidden; display:flex; flex-direction:column;
  background:#fff; box-shadow:0 2px 9px rgba(0,0,0,.07); min-height:0; }
.msc-prod-media{ position:relative; height:52mm; background:#fff; flex:none; border-bottom:1px solid rgba(0,0,0,.08); }
.msc-prod-media img{ width:100%; height:100%; object-fit:contain; padding:2.5mm; display:block; }
.msc-noimg{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:48pt; font-weight:900;
  color:var(--c-primary); opacity:.22; background:linear-gradient(135deg,#f8fafc,#eef2f7); }
.msc-prod-no{ position:absolute; top:0; inset-inline-start:0; background:var(--c-primary); color:#fff; font-size:10.5pt; font-weight:800;
  min-width:10mm; height:9mm; padding:0 3mm; display:flex; align-items:center; justify-content:center; border-end-end-radius:3.5mm; box-shadow:0 2px 7px rgba(0,0,0,.22); }
.msc-prod-info{ flex:1; display:flex; flex-direction:column; padding:4mm 4.5mm 3.8mm; min-height:0; overflow:hidden; }
/* name + price are flex:none; description grows to fill remaining card height (clipped at bottom, not after 2 lines). */
.msc-prod-name{ flex:none; font-size:13pt; line-height:1.22; font-weight:800; color:var(--c-heading); margin:0 0 2mm;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.msc-prod-tags{ flex:none; display:flex; flex-wrap:wrap; gap:2mm; margin-bottom:2mm; }
.msc-tag{ font-size:8.6pt; font-weight:700; color:var(--c-primary); background:color-mix(in srgb, var(--c-primary) 9%, #fff);
  border:1px solid color-mix(in srgb, var(--c-primary) 22%, #fff); border-radius:4px; padding:1.5px 7px; white-space:nowrap; }
.msc-tag.soft{ color:var(--c-text); background:#f1f5f9; border-color:#e2e8f0; }
.msc-tag.origin{ display:inline-flex; align-items:center; gap:4px; }
.msc-tag.origin img{ height:9pt; width:auto; border-radius:1px; }
.msc-prod-desc{ flex:1 1 auto; min-height:0; font-size:9.4pt; line-height:1.5; color:var(--c-text); margin:0 0 2mm;
  overflow:hidden; word-break:break-word; text-align:justify; text-justify:inter-word; hyphens:auto; }
.msc-prod-specs{ flex:none; font-size:8.8pt; line-height:1.4; color:var(--c-text); margin:0 0 2mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.msc-prod-specs b{ color:var(--c-heading); font-weight:700; }
/* flex-wrap + a real min-width on the meta column: when the price block is wide (long incoterm/rate
   labels), it drops to its OWN full-width line instead of crushing the meta to one-word-per-line
   (which then overflowed the fixed-height card and got clipped in the preview & PDF). */
.msc-prod-bottom{ flex:none; margin-top:auto; padding-top:2.2mm; border-top:1.5px solid rgba(0,0,0,.1);
  display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:2mm 4mm; }
.msc-prod-meta{ font-size:8.8pt; font-weight:600; color:var(--c-text); opacity:.85; line-height:1.4; flex:1 1 40mm; min-width:40mm;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.msc-prod-price{ font-weight:900; color:var(--c-primary); text-align:end; flex:0 1 auto; max-width:100%; margin-inline-start:auto; }
.msc-price-main{ font-size:14pt; line-height:1.15; white-space:nowrap; }
.msc-price-unit{ font-size:9pt; font-weight:600; opacity:.7; }
.msc-price-pack{ display:block; font-size:8.6pt; font-weight:600; opacity:.7; }
.msc-price-quote{ font-size:10.5pt; font-weight:800; color:var(--c-text); opacity:.7; font-style:italic; white-space:nowrap; }
.msc-price-neg{ font-size:10.5pt; font-weight:800; color:var(--c-primary); white-space:nowrap; border:1px dashed color-mix(in srgb, var(--c-primary) 40%, #fff); border-radius:4px; padding:1px 8px; }
.msc-price-opts{ display:flex; flex-direction:column; align-items:flex-end; gap:1mm; max-width:100%; }
.msc-price-opt{ font-size:8.6pt; font-weight:700; color:var(--c-heading); background:color-mix(in srgb, var(--c-primary) 8%, #fff);
  border:1px solid color-mix(in srgb, var(--c-primary) 20%, #fff); border-radius:4px; padding:1px 7px; text-align:end; max-width:100%; overflow-wrap:anywhere; }
.msc-price-opt b{ color:var(--c-primary); }

/* ── Real-estate cards: taller single-row grid, full spec block fills the card ── */
.msc-grid-re{ grid-template-rows:1fr; }
.msc-prod-re .msc-prod-media{ height:40mm; }
.msc-prod-re .msc-prod-desc.msc-re-desc{ flex:none; max-height:22mm; text-align:justify; text-justify:inter-word; hyphens:auto; }
.msc-re-chips{ flex:none; display:flex; flex-wrap:wrap; gap:1.5mm; margin-bottom:2.5mm; }
.msc-re-chip{ font-size:8pt; font-weight:800; color:var(--c-heading); background:#f1f5f9;
  border:1px solid #e2e8f0; border-radius:4px; padding:1.5px 7px; white-space:nowrap; }
.msc-re-specs{ flex:1 1 auto; min-height:0; margin:0; padding:0; display:grid; grid-template-columns:1fr 1fr;
  gap:1.2mm 4mm; align-content:start; overflow:hidden; }
.msc-re-spec-row{ min-width:0; }
.msc-re-spec-row dt{ font-size:7.4pt; font-weight:800; color:var(--c-primary); margin:0 0 0.5px;
  letter-spacing:.2px; line-height:1.25; }
.msc-re-spec-row dd{ font-size:8.2pt; font-weight:600; color:var(--c-heading); margin:0; line-height:1.35;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; }
.msc-prod-re .msc-prod-bottom{ width:100%; justify-content:flex-end; }

/* ── Back cover ── */
.msc-back{ background:linear-gradient(160deg, var(--c-cover), var(--c-primary)); color:var(--c-coverText);
  align-items:center; justify-content:center; text-align:center; }
.msc-back-inner{ padding:24mm 18mm; display:flex; flex-direction:column; align-items:center; gap:5mm; max-width:160mm; }
.msc-back-logo-plate{ display:inline-flex; align-items:center; justify-content:center; background:#fff; border-radius:4mm;
  padding:5mm 7mm; box-shadow:0 8px 26px rgba(0,0,0,.28); border:1px solid rgba(0,0,0,.06); margin-bottom:2mm; }
.msc-back-logo{ max-height:22mm; max-width:72mm; width:auto; object-fit:contain; display:block; }
.msc-back-logo-txt{ font-size:24pt; font-weight:900; }
.msc-back-title{ font-size:26pt; font-weight:900; margin:0; }
.msc-back-sub{ font-size:12pt; line-height:1.6; opacity:.92; margin:0; max-width:135mm;
  display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; overflow:hidden; }
.msc-back-qr{ display:flex; flex-direction:column; align-items:center; gap:3mm; margin:4mm 0; }
.msc-back-qr img{ width:42mm; height:42mm; background:#fff; padding:3mm; border-radius:4mm; box-shadow:0 6px 20px rgba(0,0,0,.25); border:1px solid rgba(0,0,0,.06); }
.msc-back-qr span{ font-size:10pt; font-weight:700; opacity:.95; }
.msc-back-contact{ display:grid; grid-template-columns:auto auto; gap:4mm 12mm; margin-top:3mm; text-align:start; }
.msc-back-contact .wide{ grid-column:1 / -1; }
.msc-back-contact div{ display:flex; flex-direction:column; gap:2px; }
.msc-back-contact span{ font-size:8pt; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; opacity:.7; }
.msc-back-contact b{ font-size:12pt; font-weight:700; }
.msc-back-link{ margin-top:4mm; font-size:10.5pt; font-weight:700; opacity:.95; background:rgba(255,255,255,.18);
  padding:4px 16px; border-radius:20px; color:inherit; text-decoration:underline; text-underline-offset:3px; display:inline-block; }
.msc-back-link:hover{ background:rgba(255,255,255,.28); }

/* ── Print ── */
@media print {
  @page{ size:A4; margin:0; }
  html, body{ margin:0 !important; padding:0 !important; background:#fff !important; }
  .msc-root{ background:#fff !important; }
  /* Soft box/text shadows & backdrop blur render as hard grey rectangles ("halos") in many mobile PDF
     viewers — strip them so the exported PDF is clean on every device. Borders keep the definition. */
  .msc-root *{ box-shadow:none !important; text-shadow:none !important; backdrop-filter:none !important; }
  .msc-noprint{ display:none !important; }
  .msc-pages{ gap:0 !important; padding:0 !important; display:block !important; }
  .msc-page{ width:210mm !important; height:297mm !important; min-height:297mm !important; margin:0 !important;
    box-shadow:none !important; overflow:hidden; break-inside:avoid; page-break-after:always; break-after:page; }
  .msc-page:last-child{ page-break-after:auto; break-after:auto; }
}

/* ── Screen: scale pages down on narrow viewports so the toolbar/button stay usable ── */
@media screen and (max-width:840px){
  .msc-pages{ padding:16px 0 50px; }
  .msc-page{ transform:scale(.62); transform-origin:top center; margin-bottom:-110mm; }
}
@media screen and (max-width:560px){
  .msc-page{ transform:scale(.46); margin-bottom:-160mm; }
}
`;
