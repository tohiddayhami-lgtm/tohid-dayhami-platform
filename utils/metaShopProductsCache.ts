import type { MetaShop, MetaShopProduct } from '../types';

const PREFIX = 'ms_products_v1_';
const TTL_MS = 12 * 60 * 60 * 1000;

type CacheEnvelope = {
  products: MetaShopProduct[];
  productCount: number;
  productChunkCount: number;
  ts: number;
};

export function metaShopProductsCacheVersion(shop: Pick<MetaShop, 'productCount' | 'productChunkCount'>): string {
  return `${shop.productCount ?? 0}:${shop.productChunkCount ?? 0}`;
}

/** Strip long text fields — keeps cards/prices/images for fast localStorage restore. */
function slimForCache(products: MetaShopProduct[]): MetaShopProduct[] {
  return products.map(p => {
    const { description, descriptionEn, realEstate, ...rest } = p;
    const re = realEstate
      ? { ...realEstate, description: undefined, descriptionEn: undefined, faq: undefined }
      : undefined;
    return { ...rest, realEstate: re };
  });
}

export function readMetaShopProductsCache(shop: Pick<MetaShop, 'id' | 'productCount' | 'productChunkCount'>): MetaShopProduct[] | null {
  if (!shop.id) return null;
  try {
    const raw = localStorage.getItem(PREFIX + shop.id);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope;
    if (!Array.isArray(env.products) || Date.now() - env.ts > TTL_MS) return null;
    if (metaShopProductsCacheVersion(shop) !== `${env.productCount}:${env.productChunkCount}`) return null;
    return env.products;
  } catch {
    return null;
  }
}

export function writeMetaShopProductsCache(
  shop: Pick<MetaShop, 'id' | 'productCount' | 'productChunkCount'>,
  products: MetaShopProduct[],
) {
  if (!shop.id || !products.length) return;
  const payload: CacheEnvelope = {
    products: slimForCache(products),
    productCount: shop.productCount ?? products.length,
    productChunkCount: shop.productChunkCount ?? 0,
    ts: Date.now(),
  };
  try {
    localStorage.setItem(PREFIX + shop.id, JSON.stringify(payload));
  } catch {
    try {
      localStorage.setItem(PREFIX + shop.id, JSON.stringify({
        ...payload,
        products: payload.products.map(p => ({
          id: p.id,
          name: p.name,
          images: p.images,
          image: (p as { image?: string }).image,
          price: p.price,
          currency: p.currency,
          active: p.active,
          sku: p.sku,
          group: p.group,
          subcategory: p.subcategory,
          featured: p.featured,
          pack: p.pack,
          moq: p.moq,
          priceOptions: p.priceOptions,
          outOfStock: p.outOfStock,
          imageFit: p.imageFit,
        })),
      }));
    } catch { /* quota */ }
  }
}
