import React, { useState, useEffect } from 'react';
import { metaShopProductImageUrl, metaShopProductImageDirect } from '../utils/metaShopImage';

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
  const [useDirect, setUseDirect] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUseDirect(false);
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (!direct) return null;

  const imgSrc = useDirect ? direct : (proxied || direct);

  return (
    <>
      {!loaded && !failed && <span className="ms-img-skeleton" aria-hidden="true" />}
      {!failed ? (
        <img
          src={imgSrc}
          alt={alt || ''}
          className={`${className} ${loaded ? 'is-loaded' : ''}`.trim()}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!useDirect && proxied && proxied !== direct) {
              setUseDirect(true);
              setLoaded(false);
              return;
            }
            setFailed(true);
          }}
        />
      ) : null}
    </>
  );
};
