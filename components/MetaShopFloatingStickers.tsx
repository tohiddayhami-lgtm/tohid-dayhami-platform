import React, { useMemo, useState, useEffect } from 'react';
import type { MetaShop, MetaShopFloatingSticker } from '../types';
import {
  buildFloatingStickerHref,
  filterActiveFloatingStickers,
  isMobileViewport,
} from '../utils/metaShopFloatingStickers';

export type FloatingStickerNavAction = {
  type: 'product' | 'category' | 'page' | 'external';
  target: string;
  newTab: boolean;
};

interface Props {
  shop: MetaShop;
  currentPage: string;
  onNavigate?: (action: FloatingStickerNavAction) => void;
}

const speedDur = (baseSec: number, speed?: number) => {
  const s = Math.min(2, Math.max(0.5, speed ?? 1));
  return `${(baseSec / s).toFixed(2)}s`;
};

const StickerLayer: React.FC<{
  shop: MetaShop;
  sticker: MetaShopFloatingSticker;
  onNavigate?: Props['onNavigate'];
}> = ({ shop, sticker, onNavigate }) => {
  const href = buildFloatingStickerHref(shop, sticker);
  const anim = sticker.animation || 'none';
  const speed = sticker.animationSpeed ?? 1;
  const rot = sticker.rotation ?? 0;
  const z = sticker.zIndex ?? 9000;

  const animStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      willChange: 'transform',
      ['--ms-fps-rot' as string]: `${rot}deg`,
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
      default:
        return rot ? { ...base, transform: `rotate(${rot}deg)` } : base;
    }
  }, [anim, speed, rot]);

  const handleClick = (e: React.MouseEvent) => {
    const target = (sticker.linkTarget || '').trim();
    if (!target) return;

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
        newTab: false,
      });
    }
  };

  const hasLink = sticker.linkType === 'external'
    ? !!targetTrim(sticker.linkTarget)
    : !!targetTrim(sticker.linkTarget);

  const inner = (
    <img
      src={sticker.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className="block w-full h-full object-contain select-none pointer-events-none"
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
    />
  );

  return (
    <div
      className="ms-floating-sticker fixed pointer-events-none"
      style={{
        left: `${sticker.positionX}%`,
        top: `${sticker.positionY}%`,
        width: sticker.width,
        height: sticker.height,
        zIndex: z,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden={!hasLink}
    >
      <div className="w-full h-full pointer-events-auto touch-manipulation" style={animStyle}>
        {hasLink ? (
          <a
            href={href}
            onClick={handleClick}
            target={sticker.openInNewTab ? '_blank' : undefined}
            rel={sticker.openInNewTab ? 'noopener noreferrer' : undefined}
            className="block w-full h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
            aria-label={sticker.label || 'Promotion'}
          >
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    </div>
  );
};

function targetTrim(v?: string) {
  return (v || '').trim();
}

export const MetaShopFloatingStickers: React.FC<Props> = ({ shop, currentPage, onNavigate }) => {
  const [mobile, setMobile] = useState(isMobileViewport);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const active = useMemo(
    () => filterActiveFloatingStickers(shop.floatingStickers, currentPage, mobile),
    [shop.floatingStickers, currentPage, mobile],
  );

  if (active.length === 0) return null;

  return (
    <>
      <style>{`
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
        .ms-floating-sticker img { -webkit-user-drag: none; }
      `}</style>
      {active.map(s => (
        <StickerLayer key={s.id} shop={shop} sticker={s} onNavigate={onNavigate} />
      ))}
    </>
  );
};

export default MetaShopFloatingStickers;
