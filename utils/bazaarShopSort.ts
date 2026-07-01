import type { MetaBazaar, MetaBazaarNode, MetaShop } from '../types';
import { normalizeBazaarTreeSlugs } from './bazaarShopResolve';

export const MAX_BAZAAR_FEATURED_SHOPS = 6;

export const collectBazaarShopSlugs = (tree: MetaBazaarNode[] = []): string[] => {
  const slugs = new Set<string>();
  const walk = (nodes: MetaBazaarNode[]) => {
    for (const n of nodes) {
      (n.shopSlugs || []).forEach(sl => { if (sl) slugs.add(sl); });
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return [...slugs];
};

export const getShopPriority = (bazaar: MetaBazaar | null | undefined, slug: string): number => {
  const raw = bazaar?.shopPriorities?.[slug];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
};

export const isBazaarFeaturedShop = (slug: string, bazaar: MetaBazaar | null | undefined): boolean =>
  !!(bazaar?.featuredShopSlugs || []).includes(slug);

/** Featured first (array order), then higher priority, then name. */
export const sortShopsForBazaar = (shops: MetaShop[], bazaar: MetaBazaar | null | undefined): MetaShop[] => {
  if (!bazaar || shops.length < 2) return shops;
  const featured = (bazaar.featuredShopSlugs || []).filter(Boolean);
  const featuredRank = new Map(featured.map((slug, i) => [slug, i]));
  const collator = new Intl.Collator('fa', { sensitivity: 'base' });

  return [...shops].sort((a, b) => {
    const af = featuredRank.has(a.slug) ? featuredRank.get(a.slug)! : Number.POSITIVE_INFINITY;
    const bf = featuredRank.has(b.slug) ? featuredRank.get(b.slug)! : Number.POSITIVE_INFINITY;
    if (af !== bf) return af - bf;

    const ap = getShopPriority(bazaar, a.slug);
    const bp = getShopPriority(bazaar, b.slug);
    if (ap !== bp) return bp - ap;

    return collator.compare(a.title || a.name, b.title || b.name);
  });
};

export const pruneBazaarShopMeta = (bazaar: MetaBazaar): MetaBazaar => {
  const linked = new Set(collectBazaarShopSlugs(bazaar.tree || []).map(s => s.toLowerCase()));
  const featured = (bazaar.featuredShopSlugs || [])
    .filter(sl => linked.has(sl.toLowerCase()))
    .slice(0, MAX_BAZAAR_FEATURED_SHOPS);
  const priorities: Record<string, number> = {};
  for (const [slug, val] of Object.entries(bazaar.shopPriorities || {})) {
    if (!linked.has(slug.toLowerCase())) continue;
    if (typeof val === 'number' && Number.isFinite(val)) priorities[slug] = val;
  }
  return {
    ...bazaar,
    featuredShopSlugs: featured.length ? featured : undefined,
    shopPriorities: Object.keys(priorities).length ? priorities : undefined,
  };
};

export const prepareBazaarForSave = (bazaar: MetaBazaar, shops: MetaShop[]): MetaBazaar =>
  pruneBazaarShopMeta(normalizeBazaarTreeSlugs(bazaar, shops));

export const toggleBazaarFeaturedShop = (bazaar: MetaBazaar, slug: string): MetaBazaar => {
  const cur = [...(bazaar.featuredShopSlugs || [])];
  const idx = cur.indexOf(slug);
  if (idx >= 0) {
    cur.splice(idx, 1);
    return { ...bazaar, featuredShopSlugs: cur.length ? cur : undefined };
  }
  if (cur.length >= MAX_BAZAAR_FEATURED_SHOPS) return bazaar;
  return { ...bazaar, featuredShopSlugs: [...cur, slug] };
};

export const setBazaarShopPriority = (bazaar: MetaBazaar, slug: string, priority: number): MetaBazaar => {
  const next = { ...(bazaar.shopPriorities || {}) };
  const val = Math.max(0, Math.min(9999, Math.round(priority) || 0));
  if (val === 0) delete next[slug];
  else next[slug] = val;
  return { ...bazaar, shopPriorities: Object.keys(next).length ? next : undefined };
};
