import type { MetaShop, MetaShopProduct, MetaShopProductRef } from '../types';
import { META_SHOP_FIRESTORE_MAX_BYTES } from './metaShopNormalize';

/** Per-chunk payload budget (Firestore doc max is 1 MiB). */
export const META_SHOP_CHUNK_MAX_BYTES = 950_000;

export interface MetaShopProductChunk {
  id: string;
  shopId: string;
  chunkIndex: number;
  products: MetaShopProduct[];
}

const chunkPayloadBytes = (products: MetaShopProduct[]) =>
  new TextEncoder().encode(JSON.stringify({ products })).length;

/** Split products into Firestore-sized chunks. */
export function splitProductsIntoChunks(shopId: string, products: MetaShopProduct[]): MetaShopProductChunk[] {
  if (!products.length) return [];
  const chunks: MetaShopProductChunk[] = [];
  let batch: MetaShopProduct[] = [];
  let chunkIndex = 0;

  const flush = () => {
    if (!batch.length) return;
    chunks.push({ id: `${shopId}_${chunkIndex}`, shopId, chunkIndex, products: batch });
    chunkIndex += 1;
    batch = [];
  };

  for (const p of products) {
    const next = [...batch, p];
    if (batch.length > 0 && chunkPayloadBytes(next) > META_SHOP_CHUNK_MAX_BYTES) flush();
    batch.push(p);
    if (chunkPayloadBytes(batch) > META_SHOP_CHUNK_MAX_BYTES) flush();
  }
  flush();
  return chunks;
}

export function mergeProductChunks(chunks: MetaShopProductChunk[]): MetaShopProduct[] {
  return [...chunks]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .flatMap(c => c.products || []);
}

/** Compact refs for list/search without loading full product payloads. */
export function buildProductRefs(products: MetaShopProduct[]): MetaShopProductRef[] {
  return products
    .filter(p => p.active !== false)
    .map(p => ({
      id: p.id,
      name: String(p.name || '').trim(),
      sku: p.sku?.trim() || undefined,
    }))
    .filter(r => r.id && r.name);
}

export function stripProductsForList(shop: MetaShop): MetaShop {
  const count = shop.productCount ?? (shop.products || []).length;
  return { ...shop, products: [], productCount: count };
}

/** Shop document stored in metaShops — products live in metaShopChunks. */
export function prepareMetaShopShell(
  shop: MetaShop,
  products: MetaShopProduct[],
  chunkCount: number,
): MetaShop {
  const { products: _drop, ...shell } = shop;
  return {
    ...shell,
    products: [],
    productCount: products.length,
    productChunkCount: chunkCount,
    productRefs: buildProductRefs(products),
  };
}

export function shopNeedsProductHydration(shop: MetaShop): boolean {
  if ((shop.products || []).length) return false;
  if ((shop.productChunkCount || 0) > 0) return true;
  if ((shop.productCount || 0) > 0) return true;
  return false;
}

export { META_SHOP_FIRESTORE_MAX_BYTES };
