import React, { useState, useEffect, useRef } from 'react';
import { metaShopProductImageUrl, metaShopProductImageDirect } from '../utils/metaShopImage';
import type { MetaShopImageFit } from '../utils/metaShopImageFit';

interface Props {
  src?: string;
  alt?: string;
  /** First visible cards — eager + high fetch priority */
  priority?: boolean;
  /** Proxy width hint (card ~360, detail ~720) */
  width?: number;
  className?: string;
  objectFit?: MetaShopImageFit;
}

/** Best URL to try first (proxy for hotlink-blocked CDNs, direct otherwise). */
const primaryImageSrc = (src: string | undefined, width: number): string => {
  const direct = metaShopProductImageDirect(src);
  if (!direct) return '';
  return metaShopProductImageUrl(direct, width) || direct;
};

export const MetaShopProductImage: React.FC<Props> = ({
  src, alt, priority, width = 400, className = '', objectFit = 'cover',
}) => {
  const direct = metaShopProductImageDirect(src);
  const hostRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(!!priority);
  const [imgSrc, setImgSrc] = useState(() => primaryImageSrc(src, width));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgSrc(primaryImageSrc(src, width));
    setLoaded(false);
    setFailed(false);
  }, [src, width]);

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

  if (!direct) return null;

  const fitStyle: React.CSSProperties = {
    objectFit,
    width: '100%',
    height: '100%',
    ...(objectFit === 'contain' ? { padding: 6, boxSizing: 'border-box' as const } : {}),
  };

  const handleError = () => {
    const proxied = metaShopProductImageUrl(direct, width);
    if (imgSrc !== direct && direct) {
      setImgSrc(direct);
      setLoaded(false);
      return;
    }
    if (proxied && proxied !== direct && imgSrc !== proxied) {
      setImgSrc(proxied);
      setLoaded(false);
      return;
    }
    setFailed(true);
  };

  return (
    <span ref={hostRef} className="ms-img-host">
      {!loaded && !failed && <span className="ms-img-skeleton" aria-hidden="true" />}
      {failed && (
        <span className="ms-noimg" title={alt || direct}>{(alt || '?').charAt(0)}</span>
      )}
      {visible && !failed && imgSrc ? (
        <img
          src={imgSrc}
          alt={alt || ''}
          className={`${className} ${loaded ? 'is-loaded' : 'is-pending'}`.trim()}
          style={fitStyle}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={handleError}
        />
      ) : null}
    </span>
  );
};
