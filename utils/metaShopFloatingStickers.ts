import type { MetaShop, MetaShopFloatingSticker } from '../types';

export const MAX_FLOATING_STICKERS = 3;

export const newFloatingSticker = (partial?: Partial<MetaShopFloatingSticker>): MetaShopFloatingSticker => ({
  id: `fps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  enabled: true,
  imageUrl: '',
  linkType: 'external',
  linkTarget: '',
  openInNewTab: true,
  positionX: 82,
  positionY: 72,
  width: 120,
  height: 160,
  rotation: 0,
  animation: 'float',
  animationSpeed: 1,
  zIndex: 9000,
  pageScope: 'all',
  ...partial,
});

const dayStart = (iso?: string) => {
  if (!iso?.trim()) return null;
  const d = new Date(`${iso.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

export const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

export const isStickerScheduled = (sticker: MetaShopFloatingSticker, now = Date.now()): boolean => {
  const start = dayStart(sticker.startDate);
  const end = dayStart(sticker.endDate);
  if (start != null && now < start) return false;
  if (end != null) {
    const endMs = end + 24 * 60 * 60 * 1000 - 1;
    if (now > endMs) return false;
  }
  return true;
};

export const isStickerVisibleOnPage = (
  sticker: MetaShopFloatingSticker,
  currentPage: string,
): boolean => {
  const scope = sticker.pageScope || 'all';
  if (scope === 'all') return true;
  if (scope === 'products') return currentPage === 'products';
  if (scope === 'custom') {
    const ids = sticker.pageIds || [];
    return ids.length > 0 && ids.includes(currentPage);
  }
  return true;
};

export const isStickerVisibleOnDevice = (sticker: MetaShopFloatingSticker, mobile: boolean): boolean => {
  if (sticker.desktopOnly && mobile) return false;
  if (sticker.mobileOnly && !mobile) return false;
  return true;
};

export const filterActiveFloatingStickers = (
  stickers: MetaShopFloatingSticker[] | undefined,
  currentPage: string,
  mobile = isMobileViewport(),
): MetaShopFloatingSticker[] =>
  (stickers || [])
    .filter(s => s.enabled !== false && s.imageUrl?.trim())
    .filter(s => isStickerScheduled(s))
    .filter(s => isStickerVisibleOnPage(s, currentPage))
    .filter(s => isStickerVisibleOnDevice(s, mobile))
    .slice(0, MAX_FLOATING_STICKERS);

export const buildFloatingStickerHref = (
  shop: MetaShop,
  sticker: MetaShopFloatingSticker,
  originPath?: string,
): string => {
  const base = originPath || (typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '');
  const slug = encodeURIComponent(shop.slug);
  const target = (sticker.linkTarget || '').trim();
  switch (sticker.linkType) {
    case 'product':
      return target ? `${base}?shop=${slug}&product=${encodeURIComponent(target)}` : `${base}?shop=${slug}`;
    case 'category':
      return target ? `${base}?shop=${slug}&cat=${encodeURIComponent(target)}` : `${base}?shop=${slug}`;
    case 'page':
      return target ? `${base}?shop=${slug}&tab=${encodeURIComponent(target)}` : `${base}?shop=${slug}`;
    case 'external':
    default:
      return target || '#';
  }
};

export const clampSticker = (s: MetaShopFloatingSticker): MetaShopFloatingSticker => ({
  ...s,
  positionX: Math.min(100, Math.max(0, s.positionX ?? 50)),
  positionY: Math.min(100, Math.max(0, s.positionY ?? 50)),
  width: Math.min(480, Math.max(40, s.width ?? 120)),
  height: Math.min(480, Math.max(40, s.height ?? 120)),
  rotation: ((s.rotation ?? 0) % 360 + 360) % 360,
  animationSpeed: Math.min(2, Math.max(0.5, s.animationSpeed ?? 1)),
  zIndex: Math.min(99999, Math.max(1, s.zIndex ?? 9000)),
});
