import type { MetaBazaar, MetaBazaarNode, MetaShop } from '../types';
import { collectBazaarShopSlugs } from './bazaarShopSort';

export type ShopSlugIndex = {
  bySlug: Record<string, MetaShop>;
  resolve: (slug: string) => MetaShop | undefined;
  canonical: (slug: string) => string | undefined;
};

/** Case-insensitive slug lookup — fixes tree slugs that no longer match shop.slug after renames. */
export const buildShopSlugIndex = (shops: MetaShop[]): ShopSlugIndex => {
  const bySlug: Record<string, MetaShop> = {};
  const lowerToCanonical = new Map<string, string>();
  for (const s of shops) {
    if (s.isActive === false) continue;
    bySlug[s.slug] = s;
    const lower = s.slug.toLowerCase();
    if (!lowerToCanonical.has(lower)) lowerToCanonical.set(lower, s.slug);
  }
  const resolve = (slug: string): MetaShop | undefined => {
    if (!slug) return undefined;
    const direct = bySlug[slug];
    if (direct) return direct;
    const canon = lowerToCanonical.get(slug.toLowerCase());
    return canon ? bySlug[canon] : undefined;
  };
  const canonical = (slug: string): string | undefined => resolve(slug)?.slug;
  return { bySlug, resolve, canonical };
};

const normalizeTreeSlugs = (nodes: MetaBazaarNode[], canonical: (slug: string) => string | undefined): MetaBazaarNode[] =>
  nodes.map(n => ({
    ...n,
    shopSlugs: (n.shopSlugs || [])
      .map(sl => canonical(sl) || sl.trim())
      .filter((sl, i, arr) => sl && arr.indexOf(sl) === i),
    children: n.children?.length ? normalizeTreeSlugs(n.children, canonical) : n.children,
  }));

/** Align tree / featured slugs with live shop records before save. */
export const normalizeBazaarTreeSlugs = (bazaar: MetaBazaar, shops: MetaShop[]): MetaBazaar => {
  const { canonical } = buildShopSlugIndex(shops);
  const featured = (bazaar.featuredShopSlugs || [])
    .map(sl => canonical(sl) || sl.trim())
    .filter((sl, i, arr) => sl && arr.indexOf(sl) === i);
  return {
    ...bazaar,
    tree: normalizeTreeSlugs(bazaar.tree || [], canonical),
    featuredShopSlugs: featured.length ? featured : undefined,
  };
};

/** Ensure a shop slug appears on at least one bazaar tree node (required for public lists). */
export const ensureShopInBazaarTree = (bazaar: MetaBazaar, slug: string): MetaBazaar => {
  const target = slug.trim();
  if (!target) return bazaar;
  const linked = collectBazaarShopSlugs(bazaar.tree || []);
  if (linked.some(s => s.toLowerCase() === target.toLowerCase())) return bazaar;

  const tree = [...(bazaar.tree || [])];
  if (!tree.length) {
    return {
      ...bazaar,
      tree: [{
        id: `n-other-${Date.now().toString(36)}`,
        label: { fa: 'سایر', en: 'Other' },
        shopSlugs: [target],
        children: [],
      }],
    };
  }

  const linkFirstRoot = (nodes: MetaBazaarNode[]): MetaBazaarNode[] =>
    nodes.map((n, i) => {
      if (i !== 0) return n;
      const cur = n.shopSlugs || [];
      if (cur.some(s => s.toLowerCase() === target.toLowerCase())) return n;
      return { ...n, shopSlugs: [...cur, target] };
    });

  return { ...bazaar, tree: linkFirstRoot(tree) };
};

const walkNodeShops = (
  node: MetaBazaarNode,
  resolve: (slug: string) => MetaShop | undefined,
  seen: Set<string>,
  acc: MetaShop[],
) => {
  const visit = (n: MetaBazaarNode) => {
    (n.shopSlugs || []).forEach(sl => {
      const s = resolve(sl);
      if (s && !seen.has(s.id)) { seen.add(s.id); acc.push(s); }
    });
    (n.children || []).forEach(visit);
  };
  visit(node);
};

export const collectShopsFromBazaarNode = (
  node: MetaBazaarNode,
  shops: MetaShop[],
): MetaShop[] => {
  const { resolve } = buildShopSlugIndex(shops);
  const acc: MetaShop[] = [];
  const seen = new Set<string>();
  walkNodeShops(node, resolve, seen, acc);
  return acc;
};

/** All shops that should appear on a curated bazaar / export page. */
export const collectBazaarDisplayShops = (bazaar: MetaBazaar, shops: MetaShop[]): MetaShop[] => {
  const { resolve } = buildShopSlugIndex(shops);
  const seen = new Set<string>();
  const acc: MetaShop[] = [];
  const addSlug = (slug: string) => {
    const s = resolve(slug);
    if (s && !seen.has(s.id)) { seen.add(s.id); acc.push(s); }
  };
  for (const slug of collectBazaarShopSlugs(bazaar.tree || [])) addSlug(slug);
  for (const slug of bazaar.featuredShopSlugs || []) addSlug(slug);
  return acc;
};
