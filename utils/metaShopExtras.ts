import type {
  MetaShop,
  MetaShopDiscount,
  MetaShopFee,
  MetaShopFloatingSticker,
  MetaShopPage,
  MetaShopProductRef,
} from '../types';
import { META_SHOP_CHUNK_MAX_BYTES } from './metaShopChunks';

export const META_SHOP_EXTRAS_COL = 'metaShopExtras';
export const META_SHOP_REF_CHUNKS_COL = 'metaShopRefChunks';

export type MetaShopExtrasPayload = {
  id: string;
  shopId: string;
  pages?: MetaShopPage[];
  discounts?: MetaShopDiscount[];
  groupI18n?: Record<string, Record<string, string>>;
  floatingStickers?: MetaShopFloatingSticker[];
  categories?: MetaShop['categories'];
  extraFees?: MetaShopFee[];
  searchKeywords?: string[];
  directoryCategories?: string[];
  productRefs?: MetaShopProductRef[];
  /** When productRefs are chunked into metaShopRefChunks. */
  productRefChunkCount?: number;
};

export interface MetaShopRefChunk {
  id: string;
  shopId: string;
  chunkIndex: number;
  refs: MetaShopProductRef[];
}

const BULKY_KEYS = [
  'pages',
  'productRefs',
  'groupI18n',
  'discounts',
  'floatingStickers',
  'categories',
  'extraFees',
  'searchKeywords',
  'directoryCategories',
] as const;

type BulkyKey = (typeof BULKY_KEYS)[number];

const payloadBytes = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj)).length;

const refChunkBytes = (refs: MetaShopProductRef[]) =>
  payloadBytes({ refs });

/** Split lightweight product refs into Firestore-sized chunks. */
export function splitProductRefsIntoChunks(shopId: string, refs: MetaShopProductRef[]): MetaShopRefChunk[] {
  if (!refs.length) return [];
  const chunks: MetaShopRefChunk[] = [];
  let batch: MetaShopProductRef[] = [];
  let chunkIndex = 0;

  const flush = () => {
    if (!batch.length) return;
    chunks.push({ id: `${shopId}_ref_${chunkIndex}`, shopId, chunkIndex, refs: batch });
    chunkIndex += 1;
    batch = [];
  };

  for (const ref of refs) {
    const next = [...batch, ref];
    if (batch.length > 0 && refChunkBytes(next) > META_SHOP_CHUNK_MAX_BYTES) flush();
    batch.push(ref);
    if (refChunkBytes(batch) > META_SHOP_CHUNK_MAX_BYTES) flush();
  }
  flush();
  return chunks;
}

export function mergeProductRefChunks(chunks: MetaShopRefChunk[]): MetaShopProductRef[] {
  return [...chunks]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .flatMap(c => c.refs || []);
}

/** Move bulky catalog metadata out of the main metaShops document. */
export function peelBulkyMetaShopFields(shop: MetaShop): { shell: MetaShop; extras: MetaShopExtrasPayload } {
  const shell: MetaShop = { ...shop };
  const extras: MetaShopExtrasPayload = { id: shop.id, shopId: shop.id };
  let peeledAny = false;

  for (const key of BULKY_KEYS) {
    const val = shell[key as BulkyKey];
    if (val !== undefined && val !== null && (!(Array.isArray(val)) || val.length > 0)) {
      (extras as Record<string, unknown>)[key] = val;
      delete (shell as Record<string, unknown>)[key];
      peeledAny = true;
    }
  }

  if (peeledAny) shell.extrasOffloaded = true;
  return { shell, extras };
}

export function extrasPayloadIsEmpty(extras: MetaShopExtrasPayload): boolean {
  if (extras.productRefChunkCount) return false;
  for (const key of BULKY_KEYS) {
    const val = extras[key as BulkyKey];
    if (val !== undefined && val !== null && (!(Array.isArray(val)) || val.length > 0)) return false;
  }
  return true;
}

export function graftBulkyMetaShopFields(
  shell: MetaShop,
  extras: Partial<MetaShopExtrasPayload> | null | undefined,
): MetaShop {
  if (!extras) return shell;
  const merged: MetaShop = { ...shell };
  for (const key of BULKY_KEYS) {
    const val = extras[key as BulkyKey];
    if (val !== undefined) (merged as Record<string, unknown>)[key] = val;
  }
  return merged;
}

/** If extras doc alone exceeds Firestore limit, chunk productRefs first. */
export function prepareExtrasForCloud(
  shopId: string,
  extras: MetaShopExtrasPayload,
): { extrasDoc: MetaShopExtrasPayload; refChunks: MetaShopRefChunk[] } {
  const refs = extras.productRefs || [];
  let extrasDoc: MetaShopExtrasPayload = { ...extras };

  if (refs.length && payloadBytes(extrasDoc) > META_SHOP_CHUNK_MAX_BYTES) {
    const refChunks = splitProductRefsIntoChunks(shopId, refs);
    extrasDoc = { ...extrasDoc, productRefs: undefined, productRefChunkCount: refChunks.length };
    if (payloadBytes(extrasDoc) > META_SHOP_CHUNK_MAX_BYTES) {
      throw new Error(
        'حجم صفحات و متادیتای فروشگاه بیش از حد مجاز است. متن صفحات را کوتاه کنید یا تصاویر را به لینک URL تبدیل کنید (نه فایل جاسازی‌شده).',
      );
    }
    return { extrasDoc, refChunks };
  }

  return { extrasDoc, refChunks: [] };
}
