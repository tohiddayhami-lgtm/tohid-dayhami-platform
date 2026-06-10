import React, { useState, useMemo } from 'react';
import { MetaShop } from '../types';
import { Language } from '../App';

interface Props {
  shops: MetaShop[];
  lang: Language;
  onOpenShop: (slug: string) => void;
  title?: string;
  subtitle?: string;
}

const CartIcon = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);

export const MetaShopDirectory: React.FC<Props> = ({ shops, lang, onOpenShop, title, subtitle }) => {
  // Export-focused: default to English; bilingual toggle in the header.
  const [uiLang, setUiLang] = useState<Language>('en');
  const T = uiLang === 'fa';
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');

  const OTHER = T ? 'سایر' : 'Other';
  const live = useMemo(() => shops.filter(s => s.isActive !== false), [shops]);

  type Pair = { key: string; fa: string; en: string };
  const nz = (s?: string) => (s || '').trim();
  const mkPair = (fa?: string, en?: string): Pair | null => {
    const f = nz(fa), e = nz(en); if (!f && !e) return null;
    return { key: (e || f).toLowerCase(), fa: f || e, en: e || f };
  };
  // All categories a shop belongs to (bilingual + multi, with legacy fallbacks)
  const catPairsOf = (s: MetaShop): Pair[] => {
    let pairs: (Pair | null)[] = [];
    if (s.directoryCats && s.directoryCats.length) pairs = s.directoryCats.map(c => mkPair(c.fa, c.en));
    else if (s.directoryCategories && s.directoryCategories.length) pairs = s.directoryCategories.map(c => mkPair(c, c));
    else if (s.directoryCategory) pairs = [mkPair(s.directoryCategory, s.directoryCategory)];
    const out = pairs.filter(Boolean) as Pair[];
    return out.length ? out : [{ key: '__other__', fa: 'سایر', en: 'Other' }];
  };
  const subPairOf = (s: MetaShop): Pair | null => {
    if (s.directorySub) return mkPair(s.directorySub.fa, s.directorySub.en);
    if (s.directorySubcategory) return mkPair(s.directorySubcategory, s.directorySubcategory);
    return null;
  };
  const lbl = (p: Pair) => T ? p.fa : p.en;
  const catsOf = (s: MetaShop) => catPairsOf(s).map(lbl); // for search
  // Stable number per shop (by position), so a shop shown in 2 categories keeps one number
  const numberOf = useMemo(() => {
    const m: Record<string, string> = {};
    live.forEach((s, i) => { m[s.id] = (s.shopNumber && s.shopNumber.trim()) || String(i + 1).padStart(2, '0'); });
    return m;
  }, [live]);

  // Search filter
  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return live;
    return live.filter(s => {
      const hay = `${s.name} ${s.title || ''} ${catsOf(s).join(' ')} ${s.directorySubcategory || ''} ${(s.products || []).map(p => p.name).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [live, search]);

  // Distinct categories present (by key), keeping a representative bilingual pair
  const categories = useMemo(() => {
    const m: Record<string, Pair> = {};
    live.forEach(s => catPairsOf(s).forEach(p => { if (!m[p.key]) m[p.key] = p; }));
    return Object.values(m);
  }, [live, uiLang]);

  // Group by category key → subcategory key → shops (a shop appears under each of its categories)
  const grouped = useMemo(() => {
    const cats: Record<string, { pair: Pair; subs: Record<string, { pair: Pair | null; shops: MetaShop[] }> }> = {};
    matched.forEach(s => {
      const sp = subPairOf(s);
      const subKey = sp ? sp.key : '';
      catPairsOf(s).forEach(cp => {
        if (activeCat !== 'all' && cp.key !== activeCat) return;
        const c = cats[cp.key] = cats[cp.key] || { pair: cp, subs: {} };
        const sub = c.subs[subKey] = c.subs[subKey] || { pair: sp, shops: [] };
        sub.shops.push(s);
      });
    });
    return cats;
  }, [matched, activeCat, uiLang]);

  const keyOrder = (keys: string[]) => keys.sort((a, b) => (a === '__other__' ? 1 : b === '__other__' ? -1 : a.localeCompare(b)));

  const t = {
    title: title || (T ? 'بازارچه فروشگاه‌ها' : 'Shops Bazaar'),
    subtitle: subtitle || (T ? 'فروشگاه موردنظر را پیدا کنید و وارد شوید' : 'Find a shop and step inside'),
    search: T ? 'جستجوی فروشگاه یا محصول...' : 'Search shops or products...',
    all: T ? 'همه' : 'All',
    enter: T ? 'ورود به مغازه' : 'Enter shop',
    items: T ? 'مورد' : 'items',
    products: T ? 'محصولات' : 'Products', services: T ? 'خدمات' : 'Services',
    empty: T ? 'فروشگاهی یافت نشد.' : 'No shops found.',
    shopNo: T ? 'پلاک' : 'No.',
    count: (n: number) => T ? `${n} فروشگاه` : `${n} shop${n === 1 ? '' : 's'}`,
  };

  const Storefront: React.FC<{ shop: MetaShop }> = ({ shop }) => {
    const accent = shop.theme?.cover || shop.theme?.primary || '#2d4a1a';
    const num = numberOf[shop.id] || '';
    const cats = Array.from(new Set((shop.products || []).map(p => p.group).filter(Boolean))).slice(0, 3);
    const sampleNames = (shop.products || []).slice(0, 3).map(p => p.name);
    return (
      <button className="msd-shop" onClick={() => onOpenShop(shop.slug)} style={{ ['--accent' as any]: accent }} title={shop.name}>
        {/* Awning */}
        <div className="msd-awning"><span className="msd-shop-name">{shop.title || shop.name}</span></div>

        {/* Shutter (rolls up on hover) */}
        <div className="msd-shutter">
          <div className="msd-shutter-grip" />
          <div className="msd-plate">{t.shopNo} {num}</div>
        </div>

        {/* Interior revealed under the shutter */}
        <div className="msd-interior">
          {shop.logo
            ? <img className="msd-logo" src={shop.logo} alt="" />
            : <div className="msd-logo-fallback" style={{ background: accent }}>{(shop.name || '?').charAt(0)}</div>}
          <div className="msd-type">{shop.type === 'services' ? t.services : t.products} · {(shop.products || []).length} {t.items}</div>
          {cats.length > 0 && <div className="msd-tags">{cats.map((c, i) => <span key={i}>{c}</span>)}</div>}
          {sampleNames.length > 0 && <ul className="msd-samples">{sampleNames.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <span className="msd-enter"><CartIcon s={14} /> {t.enter}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="msd-root" dir={T ? 'rtl' : 'ltr'}>
      <style>{MSD_CSS}</style>

      <header className="msd-cover">
        <div className="msd-lang">
          <button className={uiLang === 'en' ? 'on' : ''} onClick={() => setUiLang('en')}>EN</button>
          <button className={uiLang === 'fa' ? 'on' : ''} onClick={() => setUiLang('fa')}>FA</button>
        </div>
        <div className="msd-cover-inner">
          <div className="msd-bazaar-emoji">🏪</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="msd-count">{t.count(matched.length)}</div>
        </div>
      </header>

      <div className="msd-container">
        <div className="msd-search">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
        </div>

        {categories.length > 1 && (
          <div className="msd-cats">
            <button className={`msd-cat ${activeCat === 'all' ? 'on' : ''}`} onClick={() => setActiveCat('all')}>{t.all}</button>
            {[...categories].sort((a, b) => (a.key === '__other__' ? 1 : b.key === '__other__' ? -1 : lbl(a).localeCompare(lbl(b)))).map(c => (
              <button key={c.key} className={`msd-cat ${activeCat === c.key ? 'on' : ''}`} onClick={() => setActiveCat(c.key)}>{lbl(c)}</button>
            ))}
          </div>
        )}

        {matched.length === 0 ? <p className="msd-empty">{t.empty}</p> : keyOrder(Object.keys(grouped)).map(catKey => {
          const cat = grouped[catKey];
          const subKeys = Object.keys(cat.subs).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
          return (
            <section key={catKey} className="msd-section">
              <h2 className="msd-cat-title"><span>{lbl(cat.pair)}</span><i /></h2>
              {subKeys.map(subKey => {
                const sub = cat.subs[subKey];
                return (
                  <div key={subKey || '_'} className="msd-subsection">
                    {sub.pair && <h3 className="msd-sub-title">‹ {lbl(sub.pair)} ›</h3>}
                    <div className="msd-grid">
                      {sub.shops.map(s => <Storefront key={`${catKey}-${subKey}-${s.id}`} shop={s} />)}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
};

const MSD_CSS = `
.msd-root { background:#f5f1e8; min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Vazirmatn,Tahoma,sans-serif; color:#1f2a18; padding-bottom:60px; }
.msd-root * { box-sizing:border-box; }
.msd-cover { background:linear-gradient(135deg,#1f2a18,#2d4a1a); color:#fdfbf6; text-align:center; padding:54px 20px 44px; position:relative; overflow:hidden; }
.msd-cover::after { content:''; position:absolute; inset:0; background-image:repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 22px, transparent 22px 44px); pointer-events:none; }
.msd-cover-inner { position:relative; z-index:1; }
.msd-lang { position:absolute; top:14px; inset-inline-end:16px; z-index:2; display:flex; border:1px solid rgba(255,255,255,.3); border-radius:8px; overflow:hidden; }
.msd-lang button { padding:5px 11px; font-size:11px; font-weight:800; background:transparent; color:rgba(255,255,255,.75); border:none; cursor:pointer; }
.msd-lang button.on { background:#fff; color:#1f2a18; }
.msd-bazaar-emoji { font-size:40px; margin-bottom:6px; }
.msd-cover h1 { font-size:clamp(24px,4.5vw,40px); font-weight:900; letter-spacing:-.02em; }
.msd-cover p { opacity:.85; margin-top:6px; font-size:15px; }
.msd-count { display:inline-block; margin-top:14px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.2); border-radius:999px; padding:5px 16px; font-size:13px; font-weight:700; }
.msd-container { max-width:1200px; margin:0 auto; padding:0 18px; }
.msd-search { position:relative; max-width:520px; margin:-22px auto 18px; }
.msd-search input { width:100%; border:1.5px solid #e6dfce; border-radius:999px; padding:13px 44px 13px 18px; font-size:14px; outline:none; background:#fff; box-shadow:0 12px 30px rgba(31,42,24,.12); }
.msd-search input:focus { border-color:#2d4a1a; }
.msd-search svg { position:absolute; inset-inline-end:16px; top:50%; transform:translateY(-50%); color:#94a3b8; }
.msd-cats { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:26px; }
.msd-cat { border:1.5px solid #e0d8c4; background:#fff; color:#5b6650; border-radius:999px; padding:8px 18px; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
.msd-cat:hover { border-color:#2d4a1a; color:#2d4a1a; }
.msd-cat.on { background:#2d4a1a; border-color:#2d4a1a; color:#fff; box-shadow:0 4px 12px rgba(31,42,24,.2); }
.msd-empty { text-align:center; color:#9aa394; padding:50px; font-size:15px; }
.msd-section { margin-bottom:36px; }
.msd-cat-title { display:flex; align-items:center; gap:14px; font-size:18px; font-weight:900; color:#1f2a18; margin:18px 0 16px; }
.msd-cat-title span { background:#fff; border:1px solid #e6dfce; padding:6px 16px; border-radius:999px; box-shadow:0 4px 10px rgba(31,42,24,.06); }
.msd-cat-title i { flex:1; height:2px; background:repeating-linear-gradient(90deg,#d8cfb8 0 8px,transparent 8px 14px); }
.msd-subsection { margin-bottom:18px; }
.msd-sub-title { text-align:center; font-size:13px; font-weight:800; letter-spacing:.06em; color:#8a7f63; margin:6px 0 14px; }
.msd-grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); }

/* ── Storefront card ── */
.msd-shop { position:relative; height:230px; border:0; padding:0; cursor:pointer; background:#fff; border-radius:14px 14px 10px 10px; overflow:hidden; box-shadow:0 8px 22px rgba(31,42,24,.12); text-align:center; transition:transform .25s, box-shadow .25s; display:block; width:100%; }
.msd-shop:hover { transform:translateY(-6px); box-shadow:0 20px 44px rgba(31,42,24,.22); }
.msd-shop:active { transform:translateY(-2px); }
/* Awning */
.msd-awning { position:relative; height:46px; background:var(--accent); display:flex; align-items:center; justify-content:center; padding:0 10px; z-index:4; }
.msd-awning::after { content:''; position:absolute; bottom:-9px; left:0; right:0; height:10px; background:repeating-linear-gradient(90deg, var(--accent) 0 16px, #fff 16px 32px); -webkit-mask:linear-gradient(#000,#000); }
.msd-shop-name { color:#fff; font-size:13px; font-weight:800; line-height:1.15; max-height:34px; overflow:hidden; text-shadow:0 1px 2px rgba(0,0,0,.25); }
/* Shutter */
.msd-shutter { position:absolute; top:46px; left:0; right:0; bottom:0; z-index:3; background:repeating-linear-gradient(180deg,#cfd3d6 0 7px,#b9bec2 7px 9px); border-top:2px solid rgba(0,0,0,.08); transition:transform .42s cubic-bezier(.4,.0,.2,1); display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding-bottom:22px; }
.msd-shop:hover .msd-shutter { transform:translateY(-101%); }
.msd-shutter-grip { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); width:60%; height:6px; border-radius:4px; background:rgba(0,0,0,.18); }
.msd-plate { background:#1f2a18; color:#ffd76a; font-weight:900; font-size:15px; letter-spacing:.04em; padding:6px 14px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,.3); border:2px solid #ffd76a; }
/* Interior */
.msd-interior { position:absolute; top:46px; left:0; right:0; bottom:0; z-index:2; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px; }
.msd-logo { max-width:54px; max-height:46px; object-fit:contain; }
.msd-logo-fallback { width:46px; height:46px; border-radius:12px; color:#fff; font-size:22px; font-weight:900; display:flex; align-items:center; justify-content:center; }
.msd-type { font-size:11px; color:#8a7f63; font-weight:700; }
.msd-tags { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.msd-tags span { font-size:9px; font-weight:800; background:#f0ece0; color:#5b6650; border-radius:999px; padding:2px 7px; }
.msd-samples { list-style:none; margin:2px 0 0; padding:0; font-size:10px; color:#9aa394; line-height:1.5; max-height:46px; overflow:hidden; }
.msd-enter { margin-top:6px; display:inline-flex; align-items:center; gap:5px; background:var(--accent); color:#fff; font-size:11px; font-weight:800; padding:6px 14px; border-radius:999px; }
@media (hover: none) { .msd-shutter { transform:translateY(-101%); } }
`;
