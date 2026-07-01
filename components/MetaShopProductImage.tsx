import React, { useState, useEffect, useRef } from 'react';
import { metaShopProductImageUrl, metaShopProductImageDirect } from '../utils/metaShopImage';
import { acquireMetaShopImageSlot, releaseMetaShopImageSlot } from '../utils/metaShopImageQueue';

interface Props {
  src?: string;
  alt?: string;
  /** First visible cards — eager + high fetch priority */
  priority?: boolean;
  /** Proxy width hint (card ~480, detail ~720) */
  width?: number;
  className?: string;
}

export const MetaShopProductImage: React.FC<Props> = ({ src, alt, priority, width = 480, className = '' }) => {
  const direct = metaShopProductImageDirect(src);
  const proxied = direct ? metaShopProductImageUrl(direct, width) : '';
  const hostRef = useRef<HTMLSpanElement>(null);
  const slotHeld = useRef(false);

  const [visible, setVisible] = useState(!!priority);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'direct' | 'proxy'>('direct');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPhase('direct');
    setLoaded(false);
    setFailed(false);
    setReady(false);
  }, [src]);

  useEffect(() => {
    if (priority || visible) return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '280px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority, visible, src]);

  useEffect(() => {
    if (!visible || !direct) return;
    let cancelled = false;
    acquireMetaShopImageSlot(priority).then(() => {
      if (cancelled) {
        releaseMetaShopImageSlot();
        return;
      }
      slotHeld.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (slotHeld.current) {
        slotHeld.current = false;
        releaseMetaShopImageSlot();
      }
    };
  }, [visible, direct, priority, src]);

  if (!direct) return null;

  const imgSrc = phase === 'proxy' && proxied ? proxied : direct;
  const showImg = visible && ready && !failed;

  return (
    <span ref={hostRef} className="ms-img-host">
      {!loaded && !failed && <span className="ms-img-skeleton" aria-hidden="true" />}
      {showImg ? (
        <img
          src={imgSrc}
          alt={alt || ''}
          className={`${className} ${loaded ? 'is-loaded' : 'is-pending'}`.trim()}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => {
            setLoaded(true);
            if (slotHeld.current) {
              slotHeld.current = false;
              releaseMetaShopImageSlot();
            }
          }}
          onError={() => {
            if (phase === 'direct' && proxied && proxied !== direct) {
              setPhase('proxy');
              setLoaded(false);
              return;
            }
            setFailed(true);
            if (slotHeld.current) {
              slotHeld.current = false;
              releaseMetaShopImageSlot();
            }
          }}
        />
      ) : null}
    </span>
  );
};
