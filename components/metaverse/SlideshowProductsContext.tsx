import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MetaShop, MetaShopProduct, MetaverseBooth } from '../../types';
import { hydrateMetaShopProgressive } from '../../services/firebaseService';
import { collectExpoSlideshowShopSlugs, filterProductsForSlideshowHydrate } from './expoUtils';

type Ctx = {
  productsBySlug: Record<string, MetaShopProduct[]>;
  pendingSlugs: Set<string>;
  ensureShop: (slug: string) => void;
};

const SlideshowProductsCtx = createContext<Ctx | null>(null);

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
  const queueRef = useRef<string[]>([]);
  const drainingRef = useRef(false);

  shopsRef.current = shops;
  boothsRef.current = booths;

  const markPending = useCallback((slug: string, on: boolean) => {
    setPendingSlugs(prev => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length) {
        const slug = queueRef.current.shift()!;
        if (loadedRef.current.has(slug) || inflightRef.current.has(slug)) continue;
        const shell = shopsRef.current.find(s => s.slug === slug);
        if (!shell) {
          queueRef.current.push(slug);
          break;
        }
        inflightRef.current.add(slug);
        markPending(slug, true);
        try {
          const full = await hydrateMetaShopProgressive(shell);
          const list = filterProductsForSlideshowHydrate(full?.products || [], boothsRef.current, slug);
          loadedRef.current.add(slug);
          if (list.length) {
            setProductsBySlug(prev => ({ ...prev, [slug]: list }));
          }
        } catch { /* try next slug */ }
        inflightRef.current.delete(slug);
        markPending(slug, false);
      }
    } finally {
      drainingRef.current = false;
      if (queueRef.current.length) void drainQueue();
    }
  }, [markPending]);

  const ensureShop = useCallback((slug: string) => {
    const s = (slug || '').trim();
    if (!s || loadedRef.current.has(s) || inflightRef.current.has(s)) return;
    if (!queueRef.current.includes(s)) queueRef.current.push(s);
    void drainQueue();
  }, [drainQueue]);

  const slugs = useMemo(() => collectExpoSlideshowShopSlugs(booths), [booths]);
  const shopsKey = useMemo(
    () => shops.map(s => `${s.slug}:${s.id}:${s.productCount ?? 0}:${s.productChunkCount ?? 0}`).join('|'),
    [shops],
  );

  useEffect(() => {
    slugs.forEach(ensureShop);
  }, [slugs.join('|'), shopsKey, ensureShop]);

  const value = useMemo(
    () => ({ productsBySlug, pendingSlugs, ensureShop }),
    [productsBySlug, pendingSlugs, ensureShop],
  );

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
  const slug = (shopSlug || '').trim();
  useEffect(() => {
    if (slug && ctx) ctx.ensureShop(slug);
  }, [slug, ctx]);
  if (!ctx || !slug) return { products: [], loading: false };
  return {
    products: ctx.productsBySlug[slug] || [],
    loading: ctx.pendingSlugs.has(slug) && !(ctx.productsBySlug[slug]?.length),
  };
};
