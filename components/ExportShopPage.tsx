import React, { useMemo, useState } from 'react';
import { MetaShop, MetaBazaar, MetaBazaarNode, MetaShopProduct } from '../types';
import { shopCodeOf } from './shopCode';
import { IconSearch, IconBriefcase } from './Icons';
import { Language } from '../App';
import { categoryKey, categoryLabel } from '../utils/metaShopCategories';

interface Props {
  shops: MetaShop[];
  bazaars?: MetaBazaar[];
  lang: Language;
  onBack: () => void;
  onOpenShop: (slug: string) => void;
  onOpenProduct: (shopSlug: string, productId: string) => void;
  isLoading?: boolean;
}

type Bilingual = { key: string; fa: string; en: string };

const PAGE_SIZE = 9;
const ALL = '__all__';

const nz = (s?: string) => (s || '').trim();
const mkPair = (fa?: string, en?: string): Bilingual | null => {
  const f = nz(fa), e = nz(en);
  if (!f && !e) return null;
  return { key: (e || f).toLowerCase(), fa: f || e, en: e || f };
};

const lbl = (p: Bilingual, fa: boolean) => (fa ? p.fa : p.en);

const catPairsOf = (s: MetaShop): Bilingual[] => {
  let pairs: (Bilingual | null)[] = [];
  if (s.directoryCats?.length) pairs = s.directoryCats.map(c => mkPair(c.fa, c.en));
  else if (s.directoryCategories?.length) pairs = s.directoryCategories.map(c => mkPair(c, c));
  else if (s.directoryCategory) pairs = [mkPair(s.directoryCategory, s.directoryCategory)];
  const out = pairs.filter(Boolean) as Bilingual[];
  return out.length ? out : [{ key: '__other__', fa: 'سایر', en: 'Other' }];
};

const subPairOf = (s: MetaShop): Bilingual | null => {
  if (s.directorySub) return mkPair(s.directorySub.fa, s.directorySub.en);
  if (s.directorySubcategory) return mkPair(s.directorySubcategory, s.directorySubcategory);
  return null;
};

const pickExportBazaar = (bazaars: MetaBazaar[]): MetaBazaar | null => {
  const active = bazaars.filter(b => b.isActive !== false && (b.tree?.length || 0) > 0);
  const withCountry = active.find(b =>
    (b.levelLabels || []).some(l =>
      (l.fa || '').includes('کشور') || (l.en || '').toLowerCase().includes('country'),
    ),
  );
  if (withCountry) return withCountry;
  return active.sort((a, b) => (b.tree?.length || 0) - (a.tree?.length || 0))[0] || null;
};

const collectShopsFromNode = (node: MetaBazaarNode, shopBySlug: Record<string, MetaShop>): MetaShop[] => {
  const acc: MetaShop[] = [];
  const seen = new Set<string>();
  const walk = (n: MetaBazaarNode) => {
    (n.shopSlugs || []).forEach(sl => {
      const s = shopBySlug[sl];
      if (s && !seen.has(s.id)) { seen.add(s.id); acc.push(s); }
    });
    (n.children || []).forEach(walk);
  };
  walk(node);
  return acc;
};

const shopHaystack = (shop: MetaShop): string => {
  const parts: string[] = [
    shop.name, shop.title, shop.subtitle, shop.collectionText, shop.footerText,
    shop.website, shop.address, shopCodeOf(shop),
    shop.directoryCategory, shop.directorySubcategory,
    ...(shop.directoryCats || []).flatMap(c => [c.fa, c.en, c.ar, c.zh]),
    shop.directorySub?.fa, shop.directorySub?.en, shop.directorySub?.ar,
    ...(shop.pages || []).flatMap(p => [p.name, p.nameEn, p.desc, p.descEn]),
    ...(shop.products || []).flatMap(p => [
      p.name, p.sku, p.description, p.group, p.subcategory, p.hsCode,
      ...(p.priceOptions || []).flatMap(o => [o.label, o.labelEn]),
    ]),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
};

const matchingProducts = (shop: MetaShop, q: string): MetaShopProduct[] => {
  if (!q) return [];
  return (shop.products || []).filter(p => p.active !== false).filter(p => {
    const hay = [
      p.name, p.sku, p.description, p.group, p.subcategory, p.hsCode,
      ...(p.images || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }).slice(0, 4);
};

export const ExportShopPage: React.FC<Props> = ({
  shops, bazaars = [], lang, onBack, onOpenShop, onOpenProduct, isLoading = false,
}) => {
  const fa = lang === 'fa';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [countryKey, setCountryKey] = useState(ALL);
  const [cityKey, setCityKey] = useState(ALL);
  const [groupKey, setGroupKey] = useState(ALL);
  const [bazaarPath, setBazaarPath] = useState<string[]>([]);

  const exportBazaar = useMemo(() => pickExportBazaar(bazaars), [bazaars]);
  const live = useMemo(() => shops.filter(s => s.isActive !== false), [shops]);
  const shopBySlug = useMemo(() => {
    const m: Record<string, MetaShop> = {};
    live.forEach(s => { m[s.slug] = s; });
    return m;
  }, [live]);

  const t = {
    title: fa ? 'فروشگاه صادراتی' : 'Export Shop',
    subtitle: fa ? 'فروشگاه‌ها و محصولات صادراتی بر اساس کشور، شهر و گروه کالایی' : 'Export shops and products by country, city and category',
    searchPh: fa ? 'جستجو در فروشگاه، برند، محصول، کد، گروه کالایی...' : 'Search shops, brands, products, codes, categories...',
    all: fa ? 'همه' : 'All',
    country: fa ? 'کشور' : 'Country',
    city: fa ? 'شهر' : 'City',
    group: fa ? 'گروه کالایی' : 'Product group',
    empty: fa ? 'فروشگاهی یافت نشد.' : 'No shops found.',
    products: fa ? 'محصول' : 'products',
    services: fa ? 'خدمات' : 'Services',
    realestate: fa ? 'املاک' : 'Real Estate',
    enter: fa ? 'ورود به فروشگاه' : 'Open shop',
    matches: fa ? 'محصولات مرتبط' : 'Matching products',
    count: (n: number) => fa ? `${n} فروشگاه` : `${n} shop${n === 1 ? '' : 's'}`,
  };

  // ── Bazaar tree filters (country → city → group) ──
  const bazaarLevels = useMemo(() => {
    if (!exportBazaar?.tree?.length) return null;
    const levels: { depth: number; label: string; nodes: MetaBazaarNode[]; selectedId?: string }[] = [];
    let cursor: MetaBazaarNode[] = exportBazaar.tree;
    for (let depth = 0; cursor?.length; depth++) {
      const explicit = bazaarPath[depth] && cursor.some(n => n.id === bazaarPath[depth]) ? bazaarPath[depth] : undefined;
      const levelLbl = exportBazaar.levelLabels?.[depth];
      const label = fa ? (levelLbl?.fa || levelLbl?.en || '') : (levelLbl?.en || levelLbl?.fa || '');
      levels.push({ depth, label, nodes: cursor, selectedId: explicit });
      if (!explicit) break;
      const node = cursor.find(n => n.id === explicit);
      cursor = node?.children || [];
    }
    return levels;
  }, [exportBazaar, bazaarPath, fa]);

  const bazaarPool = useMemo(() => {
    if (!exportBazaar?.tree?.length) return live;
    const q = search.trim().toLowerCase();
    if (q) return live.filter(s => shopHaystack(s).includes(q));
    let activeNode: MetaBazaarNode | undefined;
    let cursor = exportBazaar.tree;
    for (let depth = 0; cursor?.length; depth++) {
      const id = bazaarPath[depth];
      if (!id || !cursor.some(n => n.id === id)) break;
      activeNode = cursor.find(n => n.id === id);
      cursor = activeNode?.children || [];
    }
    if (activeNode) return collectShopsFromNode(activeNode, shopBySlug);
    const all: MetaShop[] = [];
    const seen = new Set<string>();
    exportBazaar.tree.forEach(n => collectShopsFromNode(n, shopBySlug).forEach(s => {
      if (!seen.has(s.id)) { seen.add(s.id); all.push(s); }
    }));
    return all.length ? all : live;
  }, [exportBazaar, bazaarPath, live, shopBySlug, search]);

  // ── Fallback filters from shop metadata ──
  const countries = useMemo(() => {
    const m: Record<string, Bilingual> = {};
    live.forEach(s => catPairsOf(s).forEach(p => { if (!m[p.key]) m[p.key] = p; }));
    return Object.values(m).sort((a, b) => lbl(a, fa).localeCompare(lbl(b, fa)));
  }, [live, fa]);

  const cities = useMemo(() => {
    const m: Record<string, Bilingual> = {};
    live.forEach(s => {
      if (countryKey !== ALL && !catPairsOf(s).some(p => p.key === countryKey)) return;
      const sp = subPairOf(s);
      if (sp && !m[sp.key]) m[sp.key] = sp;
    });
    return Object.values(m).sort((a, b) => lbl(a, fa).localeCompare(lbl(b, fa)));
  }, [live, countryKey, fa]);

  const productGroups = useMemo(() => {
    const m = new Map<string, string>();
    live.forEach(s => {
      if (countryKey !== ALL && !catPairsOf(s).some(p => p.key === countryKey)) return;
      const sp = subPairOf(s);
      if (cityKey !== ALL && (!sp || sp.key !== cityKey)) return;
      (s.products || []).forEach(p => {
        if (p.active === false || !p.group) return;
        const k = categoryKey(p.group);
        if (k && !m.has(k)) m.set(k, categoryLabel(p.group, lang, s));
      });
      (s.categories || []).forEach(c => {
        const k = categoryKey(c);
        if (k && !m.has(k)) m.set(k, categoryLabel(c, lang, s));
      });
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([key, label]) => ({ key, label }));
  }, [live, countryKey, cityKey, lang]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = exportBazaar ? bazaarPool : live;

    return pool.filter(s => {
      if (!exportBazaar) {
        if (countryKey !== ALL && !catPairsOf(s).some(p => p.key === countryKey)) return false;
        const sp = subPairOf(s);
        if (cityKey !== ALL && (!sp || sp.key !== cityKey)) return false;
        if (groupKey !== ALL) {
          const hasGroup = (s.products || []).some(p => p.active !== false && categoryKey(p.group) === groupKey);
          if (!hasGroup) return false;
        }
      }
      if (!q) return true;
      return shopHaystack(s).includes(q);
    });
  }, [exportBazaar, bazaarPool, live, countryKey, cityKey, groupKey, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const qLower = search.trim().toLowerCase();

  const selectBazaarAt = (depth: number, id: string) => {
    setBazaarPath(prev => {
      const next = prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id];
      return next;
    });
    setPage(1);
  };

  const FilterRow = ({ title, value, onChange, options }: {
    title: string;
    value: string;
    onChange: (k: string) => void;
    options: { key: string; label: string; count?: number }[];
  }) => {
    if (options.length <= 1 && value === ALL) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{title}</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => { onChange(ALL); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${value === ALL ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t.all}
          </button>
          {options.map(o => (
            <button
              key={o.key}
              type="button"
              onClick={() => { onChange(o.key); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${value === o.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {o.label}{o.count != null && o.count > 0 ? ` (${o.count})` : ''}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const typeLabel = (s: MetaShop) =>
    s.type === 'services' ? t.services : s.type === 'realestate' ? t.realestate : t.products;

  return (
    <div className="animate-fade-in py-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t.subtitle}</p>
        </div>
        <button type="button" onClick={onBack} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          {fa ? 'بازگشت' : 'Back'}
        </button>
      </div>

      <div className="relative mb-5">
        <IconSearch className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={t.searchPh}
          className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
        />
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {exportBazaar && bazaarLevels && !qLower ? (
          bazaarLevels.map(lvl => (
            <FilterRow
              key={lvl.depth}
              title={lvl.label || [t.country, t.city, t.group][lvl.depth] || t.group}
              value={lvl.selectedId || ALL}
              onChange={id => {
                if (id === ALL) setBazaarPath(prev => prev.slice(0, lvl.depth));
                else selectBazaarAt(lvl.depth, id);
                setPage(1);
              }}
              options={lvl.nodes.map(n => ({
                key: n.id,
                label: fa ? (n.label?.fa || n.label?.en || '') : (n.label?.en || n.label?.fa || ''),
                count: collectShopsFromNode(n, shopBySlug).length,
              }))}
            />
          ))
        ) : (
          <>
            <FilterRow
              title={t.country}
              value={countryKey}
              onChange={k => { setCountryKey(k); setCityKey(ALL); setGroupKey(ALL); }}
              options={countries.map(c => ({ key: c.key, label: lbl(c, fa) }))}
            />
            <FilterRow
              title={t.city}
              value={cityKey}
              onChange={k => { setCityKey(k); setGroupKey(ALL); }}
              options={cities.map(c => ({ key: c.key, label: lbl(c, fa) }))}
            />
            <FilterRow
              title={t.group}
              value={groupKey}
              onChange={setGroupKey}
              options={productGroups.map(g => ({ key: g.key, label: g.label }))}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden bg-white animate-pulse">
              <div className="w-full h-40 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-4/5" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <IconBriefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t.empty}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {fa
              ? `${t.count(filtered.length)} — صفحه ${safePage} از ${totalPages}`
              : `${t.count(filtered.length)} — page ${safePage} of ${totalPages}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(shop => {
              const hits = matchingProducts(shop, qLower);
              const cover = shop.coverImage || shop.logo;
              const countriesLbl = catPairsOf(shop).map(c => lbl(c, fa)).join(' · ');
              const cityLbl = subPairOf(shop) ? lbl(subPairOf(shop)!, fa) : '';
              const prodCount = (shop.products || []).filter(p => p.active !== false).length;

              return (
                <article
                  key={shop.id}
                  className="text-start border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all bg-white flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => onOpenShop(shop.slug)}
                    className="text-start w-full group"
                  >
                    {cover ? (
                      <div className="w-full h-40 bg-gray-100 overflow-hidden">
                        <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-gray-50 flex items-center justify-center">
                        <IconBriefcase className="w-8 h-8 text-gray-200" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex gap-1 flex-wrap mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{typeLabel(shop)}</span>
                        {shopCodeOf(shop) && (
                          <span className="text-[10px] font-mono text-gray-400 border border-gray-200 px-1.5 rounded">{shopCodeOf(shop)}</span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-700">
                        {shop.title || shop.name}
                      </h3>
                      {(countriesLbl || cityLbl) && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                          {[countriesLbl, cityLbl].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {shop.subtitle && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-2">{shop.subtitle}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-2">
                        {prodCount} {t.products}
                      </p>
                    </div>
                  </button>

                  {hits.length > 0 && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-50 mt-auto">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t.matches}</p>
                      <div className="flex flex-col gap-1">
                        {hits.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onOpenProduct(shop.slug, p.id)}
                            className="text-start text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded px-2 py-1 transition-colors line-clamp-1"
                          >
                            {p.name}{p.sku ? ` (${p.sku})` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8">
              <button
                type="button"
                onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {fa ? '← قبلی' : '← Prev'}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPage(p); window.scrollTo(0, 0); }}
                  className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === safePage ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {fa ? 'بعدی →' : 'Next →'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
