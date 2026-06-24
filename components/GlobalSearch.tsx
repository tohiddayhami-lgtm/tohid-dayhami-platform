import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NewsArticle, ServiceOption, MetaShop } from '../types';
import { IconSearch, IconNewspaper, IconBriefcase, IconTag } from './Icons';
import { shopCodeOf } from './shopCode';
import { shopSearchHaystack, productSearchHaystack, textMatchesSearchQuery } from '../utils/metaShopSearch';
import { Language } from '../App';

interface Props {
  news: NewsArticle[];
  services: ServiceOption[];
  shops: MetaShop[];
  lang: Language;
  onOpenNews: (id: string) => void;
  onOpenService: (id: string) => void;
  onOpenShop: (slug: string) => void;
  onOpenProduct: (slug: string, productId: string) => void;
}

type Result =
  | { kind: 'news'; id: string; title: string; sub: string }
  | { kind: 'service'; id: string; title: string; sub: string }
  | { kind: 'shop'; slug: string; title: string; sub: string; code: string }
  | { kind: 'product'; slug: string; productId: string; title: string; sub: string; code: string };

export const GlobalSearch: React.FC<Props> = ({ news, services, shops, lang, onOpenNews, onOpenService, onOpenShop, onOpenProduct }) => {
  const T = lang === 'fa';
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const t = {
    placeholder: T ? 'جستجو در اخبار، خدمات، فروشگاه‌ها و محصولات...' : 'Search news, services, shops & products...',
    hint: T ? 'برای جستجو تایپ کنید' : 'Type to search',
    empty: T ? 'نتیجه‌ای یافت نشد.' : 'No results found.',
    news: T ? 'اخبار' : 'News', services: T ? 'خدمات' : 'Services', shops: T ? 'فروشگاه‌ها' : 'Shops', products: T ? 'محصولات' : 'Products',
    search: T ? 'جستجو' : 'Search',
  };

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];

    // News (published only)
    news.filter(n => n.isPublished !== false).forEach(n => {
      const hay = `${n.title} ${n.titleEn || ''} ${n.summary || ''} ${n.summaryEn || ''} ${(n.tags || []).join(' ')} ${n.category || ''}`.toLowerCase();
      if (textMatchesSearchQuery(hay, term)) out.push({ kind: 'news', id: n.id, title: (T ? n.title : (n.titleEn || n.title)), sub: (T ? n.summary : (n.summaryEn || n.summary)) || n.category || '' });
    });

    // Services (active only)
    services.filter(s => s.isActive !== false).forEach(s => {
      const hay = `${s.title} ${s.titleEn || ''} ${s.description || ''} ${s.descriptionEn || ''}`.toLowerCase();
      if (textMatchesSearchQuery(hay, term)) out.push({ kind: 'service', id: s.id, title: (T && s.title) ? s.title : (s.titleEn || s.title), sub: (T ? s.description : (s.descriptionEn || s.description)) || '' });
    });

    // Shops (active only) — name, title, code, custom keywords, products
    shops.filter(s => s.isActive !== false).forEach(s => {
      const code = shopCodeOf(s);
      const hay = `${shopSearchHaystack(s)} ${code}`.toLowerCase();
      if (textMatchesSearchQuery(hay, term)) out.push({ kind: 'shop', slug: s.slug, title: s.title || s.name, sub: s.name, code });
    });

    // Products across shops (name, sku, group, product & shop keywords)
    shops.filter(s => s.isActive !== false).forEach(s => {
      (s.products || []).forEach(p => {
        if (p.active === false) return;
        const hay = productSearchHaystack(s, p);
        if (textMatchesSearchQuery(hay, term)) out.push({ kind: 'product', slug: s.slug, productId: p.id, title: p.name, sub: `${s.name}${p.sku ? ` · ${p.sku}` : ''}`, code: shopCodeOf(s) });
      });
    });

    return out.slice(0, 40);
  }, [q, news, services, shops, T]);

  const grouped = useMemo(() => {
    const g: Record<string, Result[]> = { news: [], service: [], shop: [], product: [] };
    results.forEach(r => g[r.kind].push(r));
    return g;
  }, [results]);

  const pick = (r: Result) => {
    setOpen(false); setQ('');
    if (r.kind === 'news') onOpenNews(r.id);
    else if (r.kind === 'service') onOpenService(r.id);
    else if (r.kind === 'product') onOpenProduct(r.slug, r.productId);
    else onOpenShop(r.slug);
  };

  const Section: React.FC<{ label: string; icon: React.ReactNode; items: Result[] }> = ({ label, icon, items }) => {
    if (items.length === 0) return null;
    return (
      <div className="gs-section">
        <div className="gs-section-head">{icon}<span>{label}</span><b>{items.length}</b></div>
        {items.map((r, i) => (
          <button key={i} className="gs-item" onClick={() => pick(r)}>
            <div className="gs-item-title">{r.title}{('code' in r) && <span className="gs-code" dir="ltr">{r.code}</span>}</div>
            {r.sub && <div className="gs-item-sub">{r.sub}</div>}
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title={t.search} aria-label={t.search}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
        <IconSearch className="w-4 h-4" />
      </button>

      {open && (
        <div className="gs-overlay" onClick={() => setOpen(false)} dir={T ? 'rtl' : 'ltr'}>
          <style>{GS_CSS}</style>
          <div className="gs-panel" onClick={e => e.stopPropagation()}>
            <div className="gs-input-wrap">
              <IconSearch className="w-5 h-5 text-gray-400 shrink-0" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t.placeholder} className="gs-input" />
              <button onClick={() => setOpen(false)} className="gs-close">Esc</button>
            </div>
            <div className="gs-body">
              {!q.trim() ? (
                <p className="gs-hint">{t.hint}</p>
              ) : results.length === 0 ? (
                <p className="gs-hint">{t.empty}</p>
              ) : (
                <>
                  <Section label={t.shops} icon={<IconTag className="w-3.5 h-3.5" />} items={grouped.shop} />
                  <Section label={t.products} icon={<IconTag className="w-3.5 h-3.5" />} items={grouped.product} />
                  <Section label={t.services} icon={<IconBriefcase className="w-3.5 h-3.5" />} items={grouped.service} />
                  <Section label={t.news} icon={<IconNewspaper className="w-3.5 h-3.5" />} items={grouped.news} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const GS_CSS = `
.gs-overlay { position:fixed; inset:0; z-index:300; background:rgba(15,23,42,.4); backdrop-filter:blur(4px); display:flex; align-items:flex-start; justify-content:center; padding:14vh 16px 16px; animation:gsFade .15s ease; }
@keyframes gsFade { from { opacity:0; } to { opacity:1; } }
.gs-panel { width:100%; max-width:560px; background:#fff; border-radius:18px; box-shadow:0 30px 70px rgba(15,23,42,.35); overflow:hidden; display:flex; flex-direction:column; max-height:72vh; }
.gs-input-wrap { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #eef0f3; }
.gs-input { flex:1; border:0; outline:0; font-size:15px; color:#0f172a; background:transparent; }
.gs-close { font-size:10px; font-weight:700; color:#94a3b8; border:1px solid #e2e8f0; border-radius:6px; padding:3px 7px; background:#f8fafc; cursor:pointer; }
.gs-body { overflow-y:auto; padding:8px; }
.gs-hint { text-align:center; color:#94a3b8; font-size:13px; padding:28px 0; }
.gs-section { margin-bottom:6px; }
.gs-section-head { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800; color:#64748b; padding:8px 10px 4px; text-transform:uppercase; letter-spacing:.04em; }
.gs-section-head b { margin-inline-start:auto; background:#f1f5f9; color:#64748b; border-radius:999px; padding:0 7px; font-size:10px; }
.gs-item { display:block; width:100%; text-align:start; padding:9px 12px; border:0; background:transparent; border-radius:10px; cursor:pointer; }
.gs-item:hover { background:#f5f7fa; }
.gs-item-title { font-size:14px; font-weight:600; color:#0f172a; display:flex; align-items:center; gap:8px; }
.gs-code { font-size:10px; font-family:ui-monospace,monospace; font-weight:800; background:#0f172a; color:#fff; padding:1px 6px; border-radius:5px; }
.gs-item-sub { font-size:12px; color:#94a3b8; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
`;
