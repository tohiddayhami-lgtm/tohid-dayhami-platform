import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MetaShop, MetaShopFloatingSticker } from '../types';
import {
  buildFloatingStickerHref,
  filterActiveFloatingStickers,
  isMobileViewport,
  resolveStickerShopSlug,
  stickerPositionStyle,
} from '../utils/metaShopFloatingStickers';

export type FloatingStickerNavAction = {
  type: MetaShopFloatingSticker['linkType'];
  target: string;
  shopSlug?: string;
  newTab: boolean;
  href?: string;
};

interface Props {
  /** Stickers to render (defaults to shop.floatingStickers when shop is set). */
  stickers?: MetaShopFloatingSticker[];
  /** Default MetaShop slug for product/category/page links. */
  defaultShopSlug?: string;
  /** Legacy: single-shop storefront. */
  shop?: MetaShop;
  currentPage?: string;
  onNavigate?: (action: FloatingStickerNavAction) => void;
}

const speedDur = (baseSec: number, speed?: number) => {
  const s = Math.min(2, Math.max(0.5, speed ?? 1));
  return `${(baseSec / s).toFixed(2)}s`;
};

const boxStyle = (sticker: MetaShopFloatingSticker, z: number): React.CSSProperties => {
  const w = sticker.width ?? 120;
  const h = sticker.height ?? 160;
  return {
    position: 'fixed',
    ...stickerPositionStyle(sticker),
    width: w,
    height: h,
    minWidth: w,
    minHeight: h,
    maxWidth: w,
    maxHeight: h,
    zIndex: z,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };
};

const fill: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  maxWidth: '100%',
  maxHeight: '100%',
  boxSizing: 'border-box',
};

const StickerLayer: React.FC<{
  sticker: MetaShopFloatingSticker;
  defaultShopSlug?: string;
  onNavigate?: Props['onNavigate'];
}> = ({ sticker, defaultShopSlug, onNavigate }) => {
  const href = buildFloatingStickerHref(sticker, defaultShopSlug);
  const anim = sticker.animation || 'none';
  const speed = sticker.animationSpeed ?? 1;
  const rot = sticker.rotation ?? 0;
  const z = sticker.zIndex ?? 9000;
  const is3dSpin = anim === 'productSpin360';
  const [imgReady, setImgReady] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImgReady(false);
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setImgReady(true);
  }, [sticker.imageUrl]);

  const animStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      ...fill,
      willChange: 'transform',
      ['--ms-fps-rot' as string]: `${rot}deg`,
      animationPlayState: imgReady ? 'running' : 'paused',
    };
    switch (anim) {
      case 'float':
        return {
          ...base,
          animation: `ms-fps-float ${speedDur(4, speed)} ease-in-out infinite`,
        };
      case 'bounce':
        return {
          ...base,
          animation: `ms-fps-bounce ${speedDur(1.8, speed)} ease-in-out infinite`,
        };
      case 'pulse':
        return {
          ...base,
          animation: `ms-fps-pulse ${speedDur(2, speed)} ease-in-out infinite`,
        };
      case 'shake':
        return {
          ...base,
          animation: `ms-fps-shake ${speedDur(0.6, speed)} ease-in-out infinite`,
        };
      case 'spin':
        return {
          ...base,
          animation: `ms-fps-spin ${speedDur(6, speed)} linear infinite`,
        };
      case 'productSpin360':
        return {
          ...base,
          perspective: '900px',
          perspectiveOrigin: 'center center',
        };
      default:
        return rot ? { ...base, transform: `rotate(${rot}deg)` } : base;
    }
  }, [anim, speed, rot, imgReady]);

  const spin3dStyle = useMemo((): React.CSSProperties | undefined => {
    if (!is3dSpin) return undefined;
    return {
      ...fill,
      transformStyle: 'preserve-3d',
      animation: `ms-fps-product-spin ${speedDur(8, speed)} linear infinite`,
      animationPlayState: imgReady ? 'running' : 'paused',
    };
  }, [is3dSpin, speed, imgReady]);

  const shopSlug = resolveStickerShopSlug(sticker, defaultShopSlug);
  const target = (sticker.linkTarget || '').trim();
  const hasLink = sticker.linkType === 'external' || sticker.linkType === 'shop'
    ? !!target
    : !!shopSlug && (sticker.linkType === 'product' || sticker.linkType === 'category' || sticker.linkType === 'page' ? !!target : true);

  const handleClick = (e: React.MouseEvent) => {
    if (!hasLink && sticker.linkType !== 'external') return;
    if (sticker.linkType === 'external' && !target) return;

    if (sticker.openInNewTab) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    if (onNavigate && sticker.linkType !== 'external') {
      e.preventDefault();
      onNavigate({
        type: sticker.linkType,
        target,
        shopSlug: shopSlug || (sticker.linkType === 'shop' ? target : undefined),
        newTab: false,
        href,
      });
    }
  };

  const imgStyle: React.CSSProperties = {
    ...fill,
    objectFit: 'contain',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
    userSelect: 'none',
  };

  const inner = (
    <img
      ref={imgRef}
      src={sticker.imageUrl}
      alt=""
      width={sticker.width ?? 120}
      height={sticker.height ?? 160}
      loading="eager"
      decoding="sync"
      draggable={false}
      style={imgStyle}
      onLoad={() => setImgReady(true)}
    />
  );

  const content = hasLink ? (
    <a
      href={href}
      onClick={handleClick}
      target={sticker.openInNewTab ? '_blank' : undefined}
      rel={sticker.openInNewTab ? 'noopener noreferrer' : undefined}
      style={{ ...fill, cursor: 'pointer', touchAction: 'manipulation' }}
      aria-label={sticker.label || 'Promotion'}
    >
      {inner}
    </a>
  ) : inner;

  return (
    <div
      className="ms-floating-sticker"
      style={boxStyle(sticker, z)}
      aria-hidden={!hasLink}
    >
      <div style={{ ...fill, pointerEvents: 'auto', touchAction: 'manipulation' }}>
        <div style={animStyle}>
          {is3dSpin ? (
            <div style={spin3dStyle}>{content}</div>
          ) : content}
        </div>
      </div>
    </div>
  );
};

function targetTrim(v?: string) {
  return (v || '').trim();
}

export const MetaShopFloatingStickers: React.FC<Props> = ({
  stickers: stickersProp,
  defaultShopSlug: defaultShopSlugProp,
  shop,
  currentPage = 'products',
  onNavigate,
}) => {
  const stickers = stickersProp ?? shop?.floatingStickers;
  const defaultShopSlug = defaultShopSlugProp ?? shop?.slug;

  const [mobile, setMobile] = useState(isMobileViewport);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const active = useMemo(
    () => filterActiveFloatingStickers(stickers, currentPage, mobile),
    [stickers, currentPage, mobile],
  );

  if (active.length === 0) return null;

  const layer = (
    <>
      <style>{`
        .ms-floating-sticker {
          position: fixed !important;
          pointer-events: none;
        }
        .ms-floating-sticker img {
          -webkit-user-drag: none;
          backface-visibility: hidden;
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain;
          display: block;
        }
        @keyframes ms-fps-float {
          0%, 100% { transform: translateY(0) rotate(var(--ms-fps-rot, 0deg)); }
          50% { transform: translateY(-12px) rotate(var(--ms-fps-rot, 0deg)); }
        }
        @keyframes ms-fps-bounce {
          0%, 100% { transform: translateY(0) rotate(var(--ms-fps-rot, 0deg)); }
          50% { transform: translateY(-18px) rotate(var(--ms-fps-rot, 0deg)); }
        }
        @keyframes ms-fps-pulse {
          0%, 100% { transform: scale(1) rotate(var(--ms-fps-rot, 0deg)); }
          50% { transform: scale(1.06) rotate(var(--ms-fps-rot, 0deg)); }
        }
        @keyframes ms-fps-shake {
          0%, 100% { transform: translateX(0) rotate(var(--ms-fps-rot, 0deg)); }
          25% { transform: translateX(-4px) rotate(var(--ms-fps-rot, 0deg)); }
          75% { transform: translateX(4px) rotate(var(--ms-fps-rot, 0deg)); }
        }
        @keyframes ms-fps-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ms-fps-product-spin {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }
      `}</style>
      {active.map(s => (
        <StickerLayer key={s.id} sticker={s} defaultShopSlug={defaultShopSlug} onNavigate={onNavigate} />
      ))}
    </>
  );

  return createPortal(layer, document.body);
};

export default MetaShopFloatingStickers;
