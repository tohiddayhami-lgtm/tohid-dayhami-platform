import React, { useMemo, useState } from 'react';
import { MetaShop, MetaBazaar, MetaBazaarNode, MetaShopProduct } from '../types';
import { shopCodeOf } from './shopCode';
import { shopMatchesSearch, productMatchesSearch } from '../utils/metaShopSearch';
import { IconSearch, IconBriefcase } from './Icons';
import { BazaarPassageLoader } from './BazaarPassageLoader';
import { Language } from '../App';

interface Props {
  shops: MetaShop[];
  bazaar: MetaBazaar | null;
  lang: Language;
  onBack: () => void;
  onOpenShop: (slug: string) => void;
  onOpenProduct: (shopSlug: string, productId: string) => void;
  isLoading?: boolean;
}

const PAGE_SIZE = 9;
const ALL = '__all__';
const MIN_SEARCH = 2;

const collectShopsFromNode = (node: MetaBazaarNode, shopBySlug: Record<string, MetaShop>): MetaShop[] => {
  const acc: MetaShop[] = [];
  const seen = new Set<string>();
  const walk = (n: MetaBazaarNode) => {
    (n.shopSlugs || []).forEach(sl => {
      const s = shopBySlug[sl];
      if (s && s.isActive !== false && !seen.has(s.id)) { seen.add(s.id); acc.push(s); }
    });
    (n.children || []).forEach(walk);
  };
  walk(node);
  return acc;
};

const collectAllBazaarShops = (bazaar: MetaBazaar, shopBySlug: Record<string, MetaShop>): MetaShop[] => {
  const acc: MetaShop[] = [];
  const seen = new Set<string>();
  (bazaar.tree || []).forEach(n => collectShopsFromNode(n, shopBySlug).forEach(s => {
    if (!seen.has(s.id)) { seen.add(s.id); acc.push(s); }
  }));
  return acc;
};

const matchingProducts = (shop: MetaShop, q: string): MetaShopProduct[] => {
  if (!q || q.length < MIN_SEARCH) return [];
  return (shop.products || []).filter(p => p.active !== false).filter(p => productMatchesSearch(shop, p, q)).slice(0, 3);
};

const bLbl = (c: { fa?: string; en?: string } | undefined, fa: boolean) =>
  fa ? (c?.fa || c?.en || '') : (c?.en || c?.fa || '');

export const ExportShopPage: React.FC<Props> = ({
  shops, bazaar, lang, onBack, onOpenShop, onOpenProduct, isLoading = false,
}) => {
  const fa = lang === 'fa';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [bazaarPath, setBazaarPath] = useState<string[]>([]);

  const shopBySlug = useMemo(() => {
    const m: Record<string, MetaShop> = {};
    shops.filter(s => s.isActive !== false).forEach(s => { m[s.slug] = s; });
    return m;
  }, [shops]);

  const bazaarShopPool = useMemo(() => {
    if (!bazaar) return [];
    return collectAllBazaarShops(bazaar, shopBySlug);
  }, [bazaar, shopBySlug]);

  const t = {
    title: fa ? 'فروشگاه بین المللی' : 'International Shop',
    subtitle: bazaar
      ? (fa ? `فروشگاه‌های ${bazaar.name}` : `Shops in ${bazaar.name}`)
      : (fa ? 'فروشگاه‌ها و محصولات صادراتی' : 'Export shops and products'),
    searchPh: fa ? 'جستجو در فروشگاه، برند، محصول، کد...' : 'Search shops, brands, products, codes...',
    all: fa ? 'همه' : 'All',
    empty: fa ? 'فروشگاهی یافت نشد.' : 'No shops found.',
    noBazaar: fa
      ? 'بازارچه‌ای برای «فروشگاه بین‌المللی» انتخاب نشده. از تنظیمات سیستم → عمومی، بازارچه مرتبط را مشخص کنید.'
      : 'No bazaar is linked to the International Shop page. Choose one in System Settings → General.',
    products: fa ? 'محصول' : 'products',
    services: fa ? 'خدمات' : 'Services',
    realestate: fa ? 'املاک' : 'Real Estate',
    matches: fa ? 'محصولات مرتبط' : 'Matching products',
    count: (n: number) => fa ? `${n} فروشگاه` : `${n} shop${n === 1 ? '' : 's'}`,
  };

  const bazaarLevels = useMemo(() => {
    if (!bazaar?.tree?.length) return null;
    const levels: { depth: number; label: string; nodes: MetaBazaarNode[]; selectedId?: string }[] = [];
    let cursor: MetaBazaarNode[] = bazaar.tree;
    for (let depth = 0; cursor?.length; depth++) {
      const explicit = bazaarPath[depth] && cursor.some(n => n.id === bazaarPath[depth]) ? bazaarPath[depth] : undefined;
      const levelLbl = bazaar.levelLabels?.[depth];
      const label = fa ? (levelLbl?.fa || levelLbl?.en || '') : (levelLbl?.en || levelLbl?.fa || '');
      levels.push({ depth, label, nodes: cursor, selectedId: explicit });
      if (!explicit) break;
      const node = cursor.find(n => n.id === explicit);
      cursor = node?.children || [];
    }
    return levels;
  }, [bazaar, bazaarPath, fa]);

  const filtered = useMemo(() => {
    if (!bazaar || !bazaarShopPool.length) return [];

    let pool = bazaarShopPool;
    const q = search.trim().toLowerCase();

    // Drill-down filters (hidden while searching to reduce clutter)
    if (!q && bazaar.tree?.length) {
      let activeNode: MetaBazaarNode | undefined;
      let cursor = bazaar.tree;
      for (let depth = 0; cursor?.length; depth++) {
        const id = bazaarPath[depth];
        if (!id || !cursor.some(n => n.id === id)) break;
        activeNode = cursor.find(n => n.id === id);
        cursor = activeNode?.children || [];
      }
      if (activeNode) pool = collectShopsFromNode(activeNode, shopBySlug);
    }

    if (!q) return pool;
    if (q.length < MIN_SEARCH) return pool;

    return pool.filter(s => shopMatchesSearch(s, q));
  }, [bazaar, bazaarShopPool, bazaarPath, shopBySlug, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const qLower = search.trim().toLowerCase();
  const showProductHits = qLower.length >= MIN_SEARCH;

  const selectBazaarAt = (depth: number, id: string) => {
    setBazaarPath(prev => (prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id]));
    setPage(1);
  };

  const FilterRow = ({ title, value, onChange, options }: {
    title: string;
    value: string;
    onChange: (k: string) => void;
    options: { key: string; label: string; count?: number }[];
  }) => {
    if (!options.length) return null;
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

  const bazaarTitle = bazaar ? (bLbl(bazaar.title, fa) || bazaar.name) : '';
  const bazaarSubtitle = bazaar ? bLbl(bazaar.subtitle, fa) : '';
  const accentCover = bazaar?.theme?.cover || '#111827';
  const heroBackground = bazaar?.coverImage
    ? `linear-gradient(to bottom, rgba(0,0,0,.42), rgba(0,0,0,.68)), url(${bazaar.coverImage}) center/cover no-repeat`
    : `linear-gradient(135deg, ${accentCover}, #374151)`;

  if (isLoading) {
    return (
      <BazaarPassageLoader
        lang={lang}
        title={t.title}
        primary={bazaar?.theme?.cover || '#5b6472'}
        accent={bazaar?.theme?.coverText || '#cbd5e1'}
      />
    );
  }

  if (!bazaar) {
    return (
      <div className="animate-fade-in py-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
          </div>
          <button type="button" onClick={onBack} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            {fa ? 'بازگشت' : 'Back'}
          </button>
        </div>
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <IconBriefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm max-w-md mx-auto leading-relaxed">{t.noBazaar}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in -mx-5">
      {/* Hero — بازارچه انتخاب‌شده */}
      <header
        className="relative overflow-hidden rounded-b-2xl text-white text-center"
        style={{ background: heroBackground, minHeight: bazaar.coverImage ? '220px' : '180px' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 pointer-events-none" aria-hidden />
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 start-5 z-10 text-xs text-white/80 hover:text-white border border-white/25 rounded-lg px-3 py-1.5 backdrop-blur-sm bg-black/20 transition-colors"
        >
          {fa ? 'بازگشت' : 'Back'}
        </button>
        <div className="relative z-[1] px-5 pt-12 pb-14 md:pt-14 md:pb-16 max-w-2xl mx-auto">
          {bazaar.logo ? (
            <img src={bazaar.logo} alt="" className="h-12 md:h-14 mx-auto mb-4 object-contain drop-shadow-md" />
          ) : (
            <div className="text-3xl mb-3 opacity-90" aria-hidden>🏪</div>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-2">{t.title}</p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight drop-shadow-sm">{bazaarTitle}</h1>
          {bazaarSubtitle && (
            <p className="text-sm text-white/85 mt-2 leading-relaxed max-w-lg mx-auto">{bazaarSubtitle}</p>
          )}
          <span className="inline-block mt-4 text-xs font-semibold bg-white/15 border border-white/25 rounded-full px-4 py-1.5 backdrop-blur-sm">
            {t.count(bazaarShopPool.length)}
          </span>
        </div>
      </header>

      <div className="px-5 pt-0">
        <div className="relative -mt-5 mb-6 z-10">
          <IconSearch className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t.searchPh}
            className="w-full ps-9 pe-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white shadow-md focus:outline-none focus:border-gray-400"
          />
        </div>

      {!qLower && bazaarLevels && (
        <div className="flex flex-col gap-4 mb-6">
          {bazaarLevels.map(lvl => (
            <FilterRow
              key={lvl.depth}
              title={lvl.label || [fa ? 'کشور' : 'Country', fa ? 'شهر' : 'City', fa ? 'گروه کالایی' : 'Group'][lvl.depth] || ''}
              value={lvl.selectedId || ALL}
              onChange={id => {
                if (id === ALL) setBazaarPath(prev => prev.slice(0, lvl.depth));
                else selectBazaarAt(lvl.depth, id);
                setPage(1);
              }}
              options={lvl.nodes.map(n => ({
                key: n.id,
                label: bLbl(n.label, fa),
                count: collectShopsFromNode(n, shopBySlug).length,
              }))}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
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
            {qLower.length > 0 && qLower.length < MIN_SEARCH && (
              <span className="text-gray-300"> · {fa ? `حداقل ${MIN_SEARCH} حرف` : `min ${MIN_SEARCH} chars`}</span>
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(shop => {
              const hits = showProductHits ? matchingProducts(shop, qLower) : [];
              const cover = shop.coverImage || shop.logo;
              const prodCount = (shop.products || []).filter(p => p.active !== false).length;

              return (
                <article
                  key={shop.id}
                  className="text-start border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all bg-white flex flex-col"
                >
                  <button type="button" onClick={() => onOpenShop(shop.slug)} className="text-start w-full group">
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
                      {shop.subtitle && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-2">{shop.subtitle}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-2">{prodCount} {t.products}</p>
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
    </div>
  );
};
