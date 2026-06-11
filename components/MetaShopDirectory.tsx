import React, { useState, useMemo } from 'react';
import { MetaShop, MetaBazaar, MetaBazaarNode } from '../types';
import { shopCodeOf } from './shopCode';
import { Language } from '../App';

interface Props {
  shops: MetaShop[];
  lang: Language;
  onOpenShop: (slug: string) => void;
  title?: string;
  subtitle?: string;
  bazaar?: MetaBazaar;   // when set, renders this curated multi-level bazaar instead of the auto "all shops" grouping
}

const CartIcon = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);

export const MetaShopDirectory: React.FC<Props> = ({ shops, lang, onOpenShop, title, subtitle, bazaar }) => {
  // Export-focused: default to English; bilingual toggle in the header.
  const [uiLang, setUiLang] = useState<Language>((bazaar?.defaultLang as Language) || 'en');
  const T = uiLang === 'fa';
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [bazaarPath, setBazaarPath] = useState<string[]>([]); // selected node id per level (bazaar drill-down)

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
  // Search filter (matches name, code, categories and products)
  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return live;
    return live.filter(s => {
      const hay = `${s.name} ${s.title || ''} ${shopCodeOf(s)} ${catsOf(s).join(' ')} ${s.directorySubcategory || ''} ${(s.products || []).map(p => p.name).join(' ')}`.toLowerCase();
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
    search: T ? 'جستجوی فروشگاه، کد یا محصول...' : 'Search shop, code or product...',
    all: T ? 'همه' : 'All',
    enter: T ? 'ورود به مغازه' : 'Enter shop',
    items: T ? 'مورد' : 'items',
    products: T ? 'محصولات' : 'Products', services: T ? 'خدمات' : 'Services',
    empty: T ? 'فروشگاهی یافت نشد.' : 'No shops found.',
    shopNo: T ? 'پلاک' : 'No.',
    count: (n: number) => T ? `${n} فروشگاه` : `${n} shop${n === 1 ? '' : 's'}`,
  };

  const Storefront: React.FC<{ shop: MetaShop }> = ({ shop }) => {
    const accent = (shop.storefrontColor && shop.storefrontColor.trim()) || shop.theme?.cover || shop.theme?.primary || '#2d4a1a';
    const num = shopCodeOf(shop);
    const tagline = ((T ? shop.storefrontTagline : (shop.storefrontTaglineEn || shop.storefrontTagline)) || '').trim();
    const cats = Array.from(new Set((shop.products || []).map(p => p.group).filter(Boolean))).slice(0, 3);
    const sampleNames = (shop.products || []).slice(0, 3).map(p => p.name);
    return (
      <button className="msd-shop" onClick={() => onOpenShop(shop.slug)} style={{ ['--accent' as any]: accent }} title={shop.name}>
        {/* Fixed header: optional banner + title (title never moves) */}
        <div className="msd-head">
          {tagline && <div className="msd-banner">{tagline}</div>}
          <div className="msd-awning"><span className="msd-shop-name">{shop.title || shop.name}</span></div>
        </div>

        {/* Body: shutter (rolls up on hover) over the interior */}
        <div className="msd-body">
          <div className="msd-shutter">
            <div className="msd-shutter-grip" />
            <div className="msd-plate" dir="ltr">{num}</div>
          </div>
          <div className="msd-interior">
            {shop.logo
              ? <img className="msd-logo" src={shop.logo} alt="" />
              : <div className="msd-logo-fallback" style={{ background: accent }}>{(shop.name || '?').charAt(0)}</div>}
            <div className="msd-type">{shop.type === 'services' ? t.services : t.products} · {(shop.products || []).length} {t.items}</div>
            {cats.length > 0 && <div className="msd-tags">{cats.map((c, i) => <span key={i}>{c}</span>)}</div>}
            {sampleNames.length > 0 && <ul className="msd-samples">{sampleNames.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <span className="msd-enter"><CartIcon s={14} /> {t.enter}</span>
          </div>
        </div>
      </button>
    );
  };

  // ════════════ BAZAAR MODE (curated multi-level tree) ════════════
  if (bazaar) {
    const shopBySlug: Record<string, MetaShop> = {};
    live.forEach(s => { shopBySlug[s.slug] = s; });
    const q = search.trim().toLowerCase();
    const shopMatches = (s: MetaShop) => !q || `${s.name} ${s.title || ''} ${shopCodeOf(s)} ${(s.products || []).map(p => p.name).join(' ')}`.toLowerCase().includes(q);
    const bLbl = (c?: { fa?: string; en?: string }) => c ? (T ? (c.fa || c.en) : (c.en || c.fa)) || '' : '';
    const accentCover = bazaar.theme?.cover || '#1f2a18';

    // Collect all shops under a node (itself + all descendants), de-duplicated, filtered by search
    const collectShops = (node: MetaBazaarNode): MetaShop[] => {
      const acc: MetaShop[] = [];
      const seen = new Set<string>();
      const walk = (n: MetaBazaarNode) => {
        (n.shopSlugs || []).forEach(sl => { const s = shopBySlug[sl]; if (s && !seen.has(s.id) && shopMatches(s)) { seen.add(s.id); acc.push(s); } });
        (n.children || []).forEach(walk);
      };
      walk(node);
      return acc;
    };

    // Drill-down levels: only follow EXPLICIT selections (depth 0 defaults to first root).
    // The grid shows the AGGREGATE of the active node's whole subtree, so a node never looks empty
    // just because its first child is empty — selecting a country shows all its shops.
    const tree = bazaar.tree || [];
    const allTreeShops = (): MetaShop[] => { const acc: MetaShop[] = []; const seen = new Set<string>(); tree.forEach(n => collectShops(n).forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); acc.push(s); } })); return acc; };
    const levels: { depth: number; nodes: MetaBazaarNode[]; selectedId?: string }[] = [];
    let cursor: MetaBazaarNode[] = tree;
    let activeNode: MetaBazaarNode | undefined;
    for (let depth = 0; cursor && cursor.length > 0; depth++) {
      // No auto-selection: an empty selection at a level means "All" (show everything at that level)
      const explicit = bazaarPath[depth] && cursor.some(n => n.id === bazaarPath[depth]) ? bazaarPath[depth] : undefined;
      levels.push({ depth, nodes: cursor, selectedId: explicit });
      if (!explicit) break;       // "All" at this level → show the active node's full subtree
      activeNode = cursor.find(n => n.id === explicit);
      cursor = activeNode?.children || [];
    }
    const gridShops = q
      ? allTreeShops()
      : (activeNode ? collectShops(activeNode) : allTreeShops());

    const selectAt = (depth: number, id: string) => setBazaarPath(prev => prev[depth] === id ? prev : [...prev.slice(0, depth), id]);

    return (
      <div className="msd-root msd-compact" dir={T ? 'rtl' : 'ltr'} style={{ ['--accent' as any]: bazaar.theme?.primary || '#2d4a1a' }}>
        <style>{MSD_CSS}</style>
        <header className="msd-cover" style={{ background: bazaar.coverImage ? `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.5)), url(${bazaar.coverImage}) center/cover` : `linear-gradient(135deg, ${accentCover}, #2d4a1a)` }}>
          <div className="msd-lang">
            <button className={uiLang === 'en' ? 'on' : ''} onClick={() => setUiLang('en')}>EN</button>
            <button className={uiLang === 'fa' ? 'on' : ''} onClick={() => setUiLang('fa')}>FA</button>
          </div>
          <div className="msd-cover-inner">
            {bazaar.logo ? <img src={bazaar.logo} alt="" style={{ height: 46, margin: '0 auto 8px', objectFit: 'contain' }} /> : <div className="msd-bazaar-emoji">🏬</div>}
            <h1>{bLbl(bazaar.title) || bazaar.name}</h1>
            {bLbl(bazaar.subtitle) && <p>{bLbl(bazaar.subtitle)}</p>}
            {bazaar.expo?.enabled && (
              <a
                href={`?expo=${encodeURIComponent(bazaar.slug)}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,.95)', color: '#1f2a18', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
              >
                🥽 {T ? 'ورود به نمایشگاه مجازی سه‌بعدی' : 'Enter 3D Virtual Exhibition'}
              </a>
            )}
          </div>
        </header>
        <div className="msd-container">
          <div className="msd-search">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </div>

          {/* Tabbed drill-down: one clean pill row per level (Country / City / Group ...) */}
          {!q && levels.map(lvl => (
            <div key={lvl.depth} className="msd-levelbar">
              {bLbl(bazaar.levelLabels?.[lvl.depth]) && <span className="msd-levelbar-label">{bLbl(bazaar.levelLabels?.[lvl.depth])}</span>}
              <div className="msd-levelbar-pills">
                <button className={`msd-cat ${!lvl.selectedId ? 'on' : ''}`} onClick={() => setBazaarPath(prev => prev.slice(0, lvl.depth))}>{t.all}</button>
                {lvl.nodes.map(n => { const cnt = collectShops(n).length; return (
                  <button key={n.id} className={`msd-cat ${lvl.selectedId === n.id ? 'on' : ''}`} onClick={() => selectAt(lvl.depth, n.id)}>{bLbl(n.label)}{cnt > 0 && <span className="msd-cat-count">{cnt}</span>}</button>
                ); })}
              </div>
            </div>
          ))}

          {gridShops.length === 0
            ? <p className="msd-empty">{t.empty}</p>
            : <div className="msd-grid" style={{ marginTop: 18 }}>{gridShops.map(s => <Storefront key={s.id} shop={s} />)}</div>}
        </div>
      </div>
    );
  }

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
.msd-levelbar { display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid #efe9da; }
.msd-levelbar:last-of-type { border-bottom:0; }
.msd-levelbar-label { flex-shrink:0; min-width:96px; font-size:12px; font-weight:800; color:#8a7f63; }
.msd-levelbar-pills { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px; }
.msd-levelbar-pills::-webkit-scrollbar { display:none; }
.msd-node { margin-bottom:22px; }
.msd-children { margin-top:8px; padding-inline-start:14px; border-inline-start:2px dashed #e0d8c4; }
.msd-depth-0 > .msd-children { border-inline-start:0; padding-inline-start:0; }
.msd-level { display:block; text-align:center; font-size:10px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#b07b2c; margin-bottom:4px; }
.msd-subsection { margin-bottom:18px; }
.msd-sub-title { text-align:center; font-size:13px; font-weight:800; letter-spacing:.06em; color:#8a7f63; margin:6px 0 14px; }
.msd-grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); }

/* ── Storefront card ── */
.msd-shop { position:relative; height:230px; border:0; padding:0; cursor:pointer; background:#fff; border-radius:14px 14px 10px 10px; overflow:hidden; box-shadow:0 8px 22px rgba(31,42,24,.12); text-align:center; transition:transform .25s, box-shadow .25s; display:flex; flex-direction:column; width:100%; }
.msd-shop:hover { transform:translateY(-6px); box-shadow:0 20px 44px rgba(31,42,24,.22); }
.msd-shop:active { transform:translateY(-2px); }
/* Fixed header (title never moves) */
.msd-head { position:relative; flex-shrink:0; z-index:4; }
/* Optional top banner (custom per-shop tagline) — glowing LED-style marquee */
.msd-banner { position:relative; background:var(--accent); color:#fff; font-size:14px; font-weight:900; letter-spacing:.02em; padding:8px 8px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 0 7px rgba(255,255,255,.85), 0 1px 2px rgba(0,0,0,.45); animation:msdLed 1.5s ease-in-out infinite; }
.msd-banner span, .msd-banner { z-index:1; }
.msd-banner::before { content:''; position:absolute; inset:0; z-index:0; background:linear-gradient(110deg, transparent 28%, rgba(255,255,255,.55) 50%, transparent 72%); transform:translateX(-130%); animation:msdSweep 2.6s linear infinite; pointer-events:none; }
@keyframes msdLed {
  0%, 100% { filter:brightness(1); box-shadow:inset 0 0 0 rgba(255,255,255,0); }
  50% { filter:brightness(1.4) saturate(1.2); box-shadow:0 0 16px 2px var(--accent), inset 0 0 14px rgba(255,255,255,.5); }
}
@keyframes msdSweep { 0% { transform:translateX(-130%); } 55%, 100% { transform:translateX(130%); } }
@media (prefers-reduced-motion: reduce) { .msd-banner { animation:none; } .msd-banner::before { display:none; } }
/* Awning (title) */
.msd-awning { position:relative; height:46px; background:var(--accent); display:flex; align-items:center; justify-content:center; padding:0 10px; }
.msd-awning::after { content:''; position:absolute; bottom:-9px; left:0; right:0; height:10px; background:repeating-linear-gradient(90deg, var(--accent) 0 16px, #fff 16px 32px); -webkit-mask:linear-gradient(#000,#000); z-index:5; }
.msd-shop-name { color:#fff; font-size:13px; font-weight:800; line-height:1.15; max-height:34px; overflow:hidden; text-shadow:0 1px 2px rgba(0,0,0,.25); }
/* Body holds the shutter + interior */
.msd-body { position:relative; flex:1; overflow:hidden; }
/* Shutter */
.msd-shutter { position:absolute; inset:0; z-index:3; background:repeating-linear-gradient(180deg,#cfd3d6 0 7px,#b9bec2 7px 9px); transition:transform .42s cubic-bezier(.4,.0,.2,1); display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding-bottom:22px; }
.msd-shop:hover .msd-shutter { transform:translateY(-101%); }
.msd-shutter-grip { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); width:60%; height:6px; border-radius:4px; background:rgba(0,0,0,.18); }
.msd-plate { background:#1f2a18; color:#ffd76a; font-weight:900; font-size:15px; letter-spacing:.04em; padding:6px 14px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,.3); border:2px solid #ffd76a; }
/* Interior */
.msd-interior { position:absolute; inset:0; z-index:2; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px; }
.msd-logo { max-width:54px; max-height:46px; object-fit:contain; }
.msd-logo-fallback { width:46px; height:46px; border-radius:12px; color:#fff; font-size:22px; font-weight:900; display:flex; align-items:center; justify-content:center; }
.msd-type { font-size:11px; color:#8a7f63; font-weight:700; }
.msd-tags { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.msd-tags span { font-size:9px; font-weight:800; background:#f0ece0; color:#5b6650; border-radius:999px; padding:2px 7px; }
.msd-samples { list-style:none; margin:2px 0 0; padding:0; font-size:10px; color:#9aa394; line-height:1.5; max-height:46px; overflow:hidden; }
.msd-enter { margin-top:6px; display:inline-flex; align-items:center; gap:5px; background:var(--accent); color:#fff; font-size:11px; font-weight:800; padding:6px 14px; border-radius:999px; }
@media (hover: none) { .msd-shutter { transform:translateY(-101%); } }

/* ── Compact / minimal (bazaar) ── */
.msd-compact .msd-cover { padding:30px 20px 26px; }
.msd-compact .msd-cover h1 { font-size:clamp(19px,3vw,28px); }
.msd-compact .msd-cover p { font-size:13px; margin-top:4px; }
.msd-compact .msd-bazaar-emoji { font-size:30px; }
.msd-compact .msd-container { max-width:1080px; }
.msd-compact .msd-search { margin:-18px auto 14px; max-width:440px; }
.msd-compact .msd-search input { padding:10px 40px 10px 16px; font-size:13px; }
.msd-compact .msd-levelbar { gap:10px; padding:6px 0; }
.msd-compact .msd-levelbar-label { min-width:78px; font-size:11px; }
.msd-compact .msd-cat { padding:5px 13px; font-size:12px; border-width:1.5px; }
.msd-cat-count { display:inline-block; margin-inline-start:5px; font-size:10px; font-weight:800; background:rgba(0,0,0,.12); border-radius:999px; padding:0 6px; }
.msd-cat.on .msd-cat-count { background:rgba(255,255,255,.28); }
.msd-compact .msd-grid { gap:12px; grid-template-columns:repeat(auto-fill,minmax(148px,1fr)); }
/* smaller storefront */
.msd-compact .msd-shop { height:150px; border-radius:11px 11px 8px 8px; box-shadow:0 5px 14px rgba(31,42,24,.10); }
.msd-compact .msd-shop:hover { transform:translateY(-4px); box-shadow:0 14px 30px rgba(31,42,24,.18); }
.msd-compact .msd-awning { height:32px; }
.msd-compact .msd-banner { font-size:12px; padding:6px 7px; }
.msd-compact .msd-shop-name { font-size:10.5px; max-height:24px; }
.msd-compact .msd-shutter { padding-bottom:14px; }
.msd-compact .msd-shutter-grip { bottom:7px; height:5px; }
.msd-compact .msd-plate { font-size:11px; padding:3px 10px; border-width:1.5px; }
.msd-compact .msd-interior { gap:3px; padding:8px; }
.msd-compact .msd-logo { max-width:42px; max-height:30px; }
.msd-compact .msd-logo-fallback { width:32px; height:32px; font-size:15px; border-radius:9px; }
.msd-compact .msd-type { font-size:9.5px; }
.msd-compact .msd-tags { display:none; }
.msd-compact .msd-samples { display:none; }
.msd-compact .msd-enter { margin-top:3px; font-size:9.5px; padding:4px 11px; }
`;
