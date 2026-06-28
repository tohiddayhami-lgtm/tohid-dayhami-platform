import type { CSSProperties } from 'react';
import type { MetaShop, MetaShopFloatingPositionAnchor, MetaShopFloatingSticker } from '../types';

export const MAX_FLOATING_STICKERS = 3;

export const newFloatingSticker = (partial?: Partial<MetaShopFloatingSticker>): MetaShopFloatingSticker => ({
  id: `fps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  enabled: true,
  imageUrl: '',
  linkType: 'external',
  linkTarget: '',
  openInNewTab: true,
  positionAnchor: 'bottom-right',
  positionX: 4,
  positionY: 4,
  width: 120,
  height: 160,
  rotation: 0,
  animation: 'productSpin360',
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
    .slice(0, MAX_FLOATING_STICKERS)
    .map(prepareStickerForDisplay);

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

export const resolveStickerAnchor = (s: MetaShopFloatingSticker): MetaShopFloatingPositionAnchor => {
  if (s.positionAnchor) return s.positionAnchor;
  // Legacy center-based coords (left/top + translate -50%) — treat as free placement
  if ((s.positionX ?? 0) > 20 || (s.positionY ?? 0) > 20) return 'free';
  return 'bottom-right';
};

/** Migrate legacy stickers (no anchor, far from corner) to bottom-right corner. */
export const prepareStickerForDisplay = (s: MetaShopFloatingSticker): MetaShopFloatingSticker => {
  const clamped = clampSticker(s);
  if (clamped.positionAnchor) return clamped;
  if ((clamped.positionX ?? 0) > 12 || (clamped.positionY ?? 0) > 12) {
    return {
      ...clamped,
      positionAnchor: 'bottom-right',
      positionX: 4,
      positionY: 4,
    };
  }
  return { ...clamped, positionAnchor: 'bottom-right' };
};

export const clampSticker = (s: MetaShopFloatingSticker): MetaShopFloatingSticker => {
  const anchor = resolveStickerAnchor(s);
  const maxInset = anchor === 'free' ? 100 : 45;
  return {
    ...s,
    positionX: Math.min(maxInset, Math.max(0, s.positionX ?? 4)),
    positionY: Math.min(maxInset, Math.max(0, s.positionY ?? 4)),
    width: Math.min(480, Math.max(40, s.width ?? 120)),
    height: Math.min(480, Math.max(40, s.height ?? 120)),
    rotation: ((s.rotation ?? 0) % 360 + 360) % 360,
    animationSpeed: Math.min(2, Math.max(0.5, s.animationSpeed ?? 1)),
    zIndex: Math.min(99999, Math.max(1, s.zIndex ?? 9000)),
  };
};

export const stickerPositionStyle = (s: MetaShopFloatingSticker): CSSProperties => {
  const sticker = prepareStickerForDisplay(s);
  const anchor = resolveStickerAnchor(sticker);
  const x = sticker.positionX;
  const y = sticker.positionY;
  switch (anchor) {
    case 'bottom-left':
      return { left: `${x}%`, bottom: `${y}%` };
    case 'top-right':
      return { right: `${x}%`, top: `${y}%` };
    case 'top-left':
      return { left: `${x}%`, top: `${y}%` };
    case 'free':
      return { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' };
    case 'bottom-right':
    default:
      return { right: `${x}%`, bottom: `${y}%` };
  }
};

/** Same as stickerPositionStyle but for the admin preview canvas (absolute positioning). */
export const stickerCanvasPositionStyle = (s: MetaShopFloatingSticker): CSSProperties => ({
  position: 'absolute',
  ...stickerPositionStyle(s),
});
