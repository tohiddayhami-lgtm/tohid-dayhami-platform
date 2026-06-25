import type { MetaShop, MetaShopProduct } from '../../types';
import { getMetaShopBySlug, loadSlideshowProductsForShop } from '../../services/firebaseService';
import { normShopSlug } from './expoUtils';

const cache = new Map<string, MetaShopProduct[]>();
const inflight = new Map<string, Promise<MetaShopProduct[]>>();

const trimForSlide = (p: MetaShopProduct): MetaShopProduct | null => {
  if (p.active === false) return null;
  const img = (p.images || []).find(u => !!String(u || '').trim());
  if (!img) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    images: [String(img)],
    i18n: p.i18n,
    active: p.active,
  };
};

/** Load (or return cached) slideshow-ready products for a shop slug. */
export async function ensureSlideshowCatalog(
  slug: string,
  shops: MetaShop[],
  linkedShop?: MetaShop | null,
): Promise<MetaShopProduct[]> {
  const key = normShopSlug(slug);
  if (!key) return [];
  if (cache.has(key)) return cache.get(key)!;

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      let shell = linkedShop
        ?? shops.find(s => normShopSlug(s.slug) === key || s.id === slug);
      if (!shell) {
        try { shell = (await getMetaShopBySlug(slug)) ?? undefined; } catch { /* skip */ }
      }
      if (!shell) return [];
      const raw = (shell.products || []).some(p => (p.images || []).some(Boolean))
        ? (shell.products || [])
        : await loadSlideshowProductsForShop(shell);
      const list = raw.map(trimForSlide).filter((p): p is MetaShopProduct => !!p);
      if (list.length) cache.set(key, list);
      return list;
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}
