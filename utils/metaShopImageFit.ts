import type { MetaShop, MetaShopProduct } from '../types';

export type MetaShopImageFit = 'cover' | 'contain';

/** Resolved CSS object-fit for a product thumbnail (default: cover). */
export function resolveProductImageFit(
  shop: Pick<MetaShop, 'productImageFit'>,
  product: Pick<MetaShopProduct, 'imageFit'>,
): MetaShopImageFit {
  if (product.imageFit === 'cover' || product.imageFit === 'contain') return product.imageFit;
  return shop.productImageFit === 'contain' ? 'contain' : 'cover';
}

export function productImageFitClass(
  shop: Pick<MetaShop, 'productImageFit'>,
  product: Pick<MetaShopProduct, 'imageFit'>,
): string {
  return resolveProductImageFit(shop, product) === 'contain' ? 'ms-img-contain' : '';
}
