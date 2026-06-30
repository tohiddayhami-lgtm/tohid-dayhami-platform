import type { MetaShop, MetaShopProduct, MetaShopProductRef } from '../types';
import { META_SHOP_FIRESTORE_MAX_BYTES } from './metaShopNormalize';

/**
 * Target size for a full chunk document (id + shopId + chunkIndex + products).
 * Firestore hard limit is 1 MiB; JSON UTF-8 underestimates protobuf encoding (~10%).
 */
export const META_SHOP_CHUNK_MAX_BYTES = 780_000;

export interface MetaShopProductChunk {
  id: string;
  shopId: string;
  chunkIndex: number;
  products: MetaShopProduct[];
}

const payloadBytes = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj)).length;

export const metaShopProductChunkDocBytes = (
  shopId: string,
  chunkIndex: number,
  products: MetaShopProduct[],
): number =>
  payloadBytes({
    id: `${shopId}_${chunkIndex}`,
    shopId,
    chunkIndex,
    products,
  });

export const metaShopRefChunkDocBytes = (
  shopId: string,
  chunkIndex: number,
  refs: MetaShopProductRef[],
): number =>
  payloadBytes({
    id: `${shopId}_ref_${chunkIndex}`,
    shopId,
    chunkIndex,
    refs,
  });

/** Split products into Firestore-sized chunks (measures the full chunk document). */
export function splitProductsIntoChunks(shopId: string, products: MetaShopProduct[]): MetaShopProductChunk[] {
  if (!products.length) return [];
  const chunks: MetaShopProductChunk[] = [];
  let batch: MetaShopProduct[] = [];
  let chunkIndex = 0;

  const batchBytes = () => metaShopProductChunkDocBytes(shopId, chunkIndex, batch);

  const flush = () => {
    if (!batch.length) return;
    if (batchBytes() > META_SHOP_FIRESTORE_MAX_BYTES) {
      const sample = batch[0];
      throw new Error(
        `محصول «${sample?.name || sample?.id || '?'}» برای ذخیره در Firebase بیش از حد بزرگ است. ` +
        'توضیحات را کوتاه کنید یا فیلدهای تکراری import را حذف کنید.',
      );
    }
    chunks.push({ id: `${shopId}_${chunkIndex}`, shopId, chunkIndex, products: batch });
    chunkIndex += 1;
    batch = [];
  };

  for (const p of products) {
    const soloBytes = metaShopProductChunkDocBytes(shopId, chunkIndex, [p]);
    if (soloBytes > META_SHOP_FIRESTORE_MAX_BYTES) {
      throw new Error(
        `محصول «${p.name || p.id}» به‌تنهایی بزرگ‌تر از حد Firebase (۱ مگابایت) است. توضیحات یا i18n آن را کوتاه کنید.`,
      );
    }
    if (batch.length > 0 && metaShopProductChunkDocBytes(shopId, chunkIndex, [...batch, p]) > META_SHOP_CHUNK_MAX_BYTES) {
      flush();
    }
    batch.push(p);
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
  return !(shop.products || []).length;
}

/** Shell list without images still needs chunk hydration for slideshow / gallery. */
export function shopProductsNeedFullHydration(shop: MetaShop): boolean {
  const products = shop.products || [];
  if (!products.length) {
    return (shop.productChunkCount || 0) > 0 || (shop.productCount || 0) > 0;
  }
  const hasImages = products.some(
    p => p.active !== false && (p.images || []).some(u => !!String(u || '').trim()),
  );
  if (hasImages) return false;
  return (shop.productChunkCount || 0) > 0 || (shop.productCount || 0) > 0;
}

export { META_SHOP_FIRESTORE_MAX_BYTES };
