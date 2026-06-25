import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MetaShop, MetaShopProduct, MetaverseBooth } from '../../types';
import { getMetaShopBySlug, loadSlideshowProductsForShop } from '../../services/firebaseService';
import { collectExpoSlideshowShopSlugs, filterProductsForSlideshowHydrate, normShopSlug } from './expoUtils';

type Ctx = {
  productsBySlug: Record<string, MetaShopProduct[]>;
  pendingSlugs: Set<string>;
};

const SlideshowProductsCtx = createContext<Ctx | null>(null);

const findShopShell = (shops: MetaShop[], slug: string): MetaShop | undefined => {
  const n = normShopSlug(slug);
  return shops.find(s => normShopSlug(s.slug) === n || s.id === slug);
};

export const SlideshowProductsProvider: React.FC<{
  shops: MetaShop[];
  booths: MetaverseBooth[] | undefined;
  children?: React.ReactNode;
}> = ({ shops, booths, children }) => {
  const [productsBySlug, setProductsBySlug] = useState<Record<string, MetaShopProduct[]>>({});
  const [pendingSlugs, setPendingSlugs] = useState<Set<string>>(() => new Set());
  const shopsRef = useRef(shops);
  const boothsRef = useRef(booths);
  const loadedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Set<string>>(new Set());

  shopsRef.current = shops;
  boothsRef.current = booths;

  const publish = useCallback((slug: string, raw: MetaShopProduct[]) => {
    const key = normShopSlug(slug);
    const list = filterProductsForSlideshowHydrate(raw, boothsRef.current, slug);
    if (!list.length) return;
    setProductsBySlug(prev => (prev[key] === list ? prev : { ...prev, [key]: list }));
  }, []);

  const loadOne = useCallback(async (slug: string) => {
    const key = normShopSlug(slug);
    if (!key || loadedRef.current.has(key) || inflightRef.current.has(key)) return;
    inflightRef.current.add(key);
    setPendingSlugs(prev => new Set(prev).add(key));
    try {
      let shell = findShopShell(shopsRef.current, slug);
      if (!shell) {
        try { shell = (await getMetaShopBySlug(slug)) || undefined; } catch { /* skip */ }
      }
      if (!shell) return;

      if ((shell.products || []).some(p => (p.images || []).some(Boolean))) {
        publish(slug, shell.products || []);
      } else {
        await loadSlideshowProductsForShop(shell, partial => publish(slug, partial));
      }
      loadedRef.current.add(key);
    } catch { /* retry on next shopsKey change */ }
    finally {
      inflightRef.current.delete(key);
      setPendingSlugs(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [publish]);

  const slugs = useMemo(() => collectExpoSlideshowShopSlugs(booths), [booths]);
  const shopsKey = useMemo(
    () => shops.map(s => `${normShopSlug(s.slug)}:${s.id}:${s.productCount ?? 0}:${s.productChunkCount ?? 0}`).join('|'),
    [shops],
  );

  useEffect(() => {
    slugs.forEach(slug => { void loadOne(slug); });
  }, [slugs.join('|'), shopsKey, loadOne]);

  const value = useMemo(() => ({ productsBySlug, pendingSlugs }), [productsBySlug, pendingSlugs]);

  return (
    <SlideshowProductsCtx.Provider value={value}>
      {children}
    </SlideshowProductsCtx.Provider>
  );
};

export const useSlideshowShopProducts = (shopSlug?: string): {
  products: MetaShopProduct[];
  loading: boolean;
} => {
  const ctx = useContext(SlideshowProductsCtx);
  const key = normShopSlug(shopSlug);
  if (!ctx || !key) return { products: [], loading: false };
  const products = ctx.productsBySlug[key] || [];
  return {
    products,
    loading: ctx.pendingSlugs.has(key) && !products.length,
  };
};
