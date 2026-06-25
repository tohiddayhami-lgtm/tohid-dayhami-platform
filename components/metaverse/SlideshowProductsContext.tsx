import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MetaShop, MetaShopProduct, MetaverseBooth } from '../../types';
import { getMetaShopBySlug, loadSlideshowProductsForShop } from '../../services/firebaseService';
import { collectExpoSlideshowShopSlugs, filterProductsForSlideshowHydrate } from './expoUtils';

type Ctx = {
  productsBySlug: Record<string, MetaShopProduct[]>;
  pendingSlugs: Set<string>;
  ensureShop: (slug: string) => void;
};

const SlideshowProductsCtx = createContext<Ctx | null>(null);

const normSlug = (s: string) => s.trim().toLowerCase();

const findShopShell = (shops: MetaShop[], slug: string): MetaShop | undefined => {
  const n = normSlug(slug);
  return shops.find(s => normSlug(s.slug || '') === n || s.id === slug);
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
  const queueRef = useRef<string[]>([]);
  const drainingRef = useRef(false);
  const retriesRef = useRef<Record<string, number>>({});

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

  const applyList = useCallback((slug: string, list: MetaShopProduct[]) => {
    if (!list.length) return;
    setProductsBySlug(prev => {
      if (prev[slug] === list) return prev;
      return { ...prev, [slug]: list };
    });
  }, []);

  const loadSlug = useCallback(async (slug: string) => {
    let shell = findShopShell(shopsRef.current, slug);
    if (!shell) {
      try {
        const remote = await getMetaShopBySlug(slug);
        if (remote) shell = remote;
      } catch { /* fall through */ }
    }
    if (!shell) return false;

    const booths = boothsRef.current;
    const publish = (raw: MetaShopProduct[]) => {
      const list = filterProductsForSlideshowHydrate(raw, booths, slug);
      applyList(slug, list);
      return list;
    };

    if ((shell.products || []).some(p => (p.images || []).some(Boolean))) {
      publish(shell.products || []);
      return true;
    }

    await loadSlideshowProductsForShop(shell, partial => {
      publish(partial);
    });
    return true;
  }, [applyList]);

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length) {
        const slug = queueRef.current.shift()!;
        if (loadedRef.current.has(slug) || inflightRef.current.has(slug)) continue;

        inflightRef.current.add(slug);
        markPending(slug, true);
        let ok = false;
        try {
          ok = await loadSlug(slug);
          if (ok) loadedRef.current.add(slug);
        } catch {
          const n = (retriesRef.current[slug] || 0) + 1;
          retriesRef.current[slug] = n;
          if (n < 3 && !queueRef.current.includes(slug)) queueRef.current.push(slug);
        }
        inflightRef.current.delete(slug);
        markPending(slug, false);
      }
    } finally {
      drainingRef.current = false;
      if (queueRef.current.length) void drainQueue();
    }
  }, [loadSlug, markPending]);

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
  const products = ctx.productsBySlug[slug] || [];
  return {
    products,
    loading: ctx.pendingSlugs.has(slug) && !products.length,
  };
};
