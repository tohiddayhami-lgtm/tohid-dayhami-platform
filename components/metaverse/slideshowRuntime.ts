import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const SLIDE_BITMAP_CACHE = new Map<string, Promise<ImageBitmap | null>>();
const MAX_CONCURRENT_LOADS = 4;
let activeLoads = 0;
const loadWaiters: (() => void)[] = [];

const acquireLoadSlot = () => new Promise<void>(resolve => {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads += 1;
    resolve();
    return;
  }
  loadWaiters.push(() => { activeLoads += 1; resolve(); });
});

const releaseLoadSlot = () => {
  activeLoads = Math.max(0, activeLoads - 1);
  const next = loadWaiters.shift();
  if (next) next();
};

export const clearSlideshowBitmapCache = () => {
  SLIDE_BITMAP_CACHE.clear();
};

export const loadSlideBitmap = (url: string, maxPx: number): Promise<ImageBitmap | null> => {
  const key = url.trim();
  if (!key) return Promise.resolve(null);
  const cacheKey = `${maxPx}|${key}`;
  let pending = SLIDE_BITMAP_CACHE.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      await acquireLoadSlot();
      try {
        return await new Promise<ImageBitmap | null>(resolve => {
          const img = new Image();
          if (!key.startsWith('data:') && !key.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
          }
          img.onload = async () => {
            try {
              const max = Math.max(img.width, img.height);
              const scale = max > maxPx ? maxPx / max : 1;
              const rw = Math.max(1, Math.round(img.width * scale));
              const rh = Math.max(1, Math.round(img.height * scale));
              if (scale < 1) {
                try {
                  resolve(await createImageBitmap(img, { resizeWidth: rw, resizeHeight: rh }));
                  return;
                } catch { /* fall through */ }
              }
              resolve(await createImageBitmap(img));
            } catch { resolve(null); }
          };
          img.onerror = () => resolve(null);
          img.src = key;
        });
      } finally {
        releaseLoadSlot();
      }
    })();
    SLIDE_BITMAP_CACHE.set(cacheKey, pending);
  }
  return pending;
};

type AutoplayEntry = {
  playing: () => boolean;
  advance: () => void;
  acc: number;
  interval: number;
  inXR: () => boolean;
};

const autoplayRegistry = new Map<string, AutoplayEntry>();

export const registerSlideshowAutoplay = (
  id: string,
  entry: Omit<AutoplayEntry, 'acc'>,
) => {
  autoplayRegistry.set(id, { ...entry, acc: 0 });
};

export const unregisterSlideshowAutoplay = (id: string) => {
  autoplayRegistry.delete(id);
};

/** One useFrame for every booth slideshow — keeps Quest from choking on N timers. */
export const SlideshowAutoplayDriver: React.FC = () => {
  useFrame((_, dt) => {
    for (const entry of autoplayRegistry.values()) {
      if (!entry.playing()) continue;
      if (!entry.inXR()) continue;
      entry.acc += dt;
      if (entry.acc >= entry.interval) {
        entry.acc = 0;
        entry.advance();
      }
    }
  });
  return null;
};

export const useSlideshowAutoplay = (
  id: string,
  playing: boolean,
  inXR: boolean,
  totalCount: number,
  autoPlaySec: number,
  advance: () => void,
) => {
  const playingRef = useRef(playing);
  const inXRRef = useRef(inXR);
  const advanceRef = useRef(advance);
  playingRef.current = playing;
  inXRRef.current = inXR;
  advanceRef.current = advance;

  useEffect(() => {
    if (!id || totalCount < 2) return;
    registerSlideshowAutoplay(id, {
      playing: () => playingRef.current,
      inXR: () => inXRRef.current,
      advance: () => advanceRef.current(),
      interval: Math.max(2, autoPlaySec),
    });
    return () => unregisterSlideshowAutoplay(id);
  }, [id, totalCount, autoPlaySec]);

  useEffect(() => {
    if (inXR || totalCount < 2) return;
    if (!playing) return;
    const ms = Math.max(2000, autoPlaySec * 1000);
    const timer = window.setInterval(() => advanceRef.current(), ms);
    return () => window.clearInterval(timer);
  }, [playing, inXR, totalCount, autoPlaySec]);
};
