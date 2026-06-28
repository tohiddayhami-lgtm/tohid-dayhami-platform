import type { MetaShop, MetaShopProduct, MetaShopBackupSlotNum } from '../types';
import { splitProductsIntoChunks, mergeProductChunks } from './metaShopChunks';

export const META_SHOP_BACKUP_SLOT_NUMS: MetaShopBackupSlotNum[] = [1, 2, 3];

export function backupMetaDocId(shopId: string, slot: MetaShopBackupSlotNum): string {
  return `${shopId}_slot_${slot}`;
}

export function backupChunkPrefix(shopId: string, slot: MetaShopBackupSlotNum): string {
  return `${shopId}_backup_${slot}`;
}

export interface MetaShopBackupChunk {
  id: string;
  shopId: string;
  slot: MetaShopBackupSlotNum;
  chunkIndex: number;
  products: MetaShopProduct[];
}

export function splitShopIntoBackupChunks(
  shopId: string,
  slot: MetaShopBackupSlotNum,
  products: MetaShopProduct[],
): MetaShopBackupChunk[] {
  const prefix = backupChunkPrefix(shopId, slot);
  return splitProductsIntoChunks(prefix, products).map(c => ({
    id: c.id,
    shopId,
    slot,
    chunkIndex: c.chunkIndex,
    products: c.products,
  }));
}

export function mergeBackupProductChunks(chunks: MetaShopBackupChunk[]): MetaShopProduct[] {
  const asProductChunks = chunks.map(c => ({
    id: c.id,
    shopId: c.shopId,
    chunkIndex: c.chunkIndex,
    products: c.products,
  }));
  return mergeProductChunks(asProductChunks);
}

export function assembleShopFromBackup(shell: MetaShop, products: MetaShopProduct[]): MetaShop {
  return {
    ...shell,
    id: shell.id,
    products,
    productCount: products.length,
    productChunkCount: undefined,
    productRefs: undefined,
  };
}
