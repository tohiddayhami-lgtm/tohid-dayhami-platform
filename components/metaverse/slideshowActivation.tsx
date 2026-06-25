import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';

const VR_MAX_ACTIVE = 6;
const ACTIVE_DIST_VR = 34;

type Entry = {
  id: string;
  ref: React.RefObject<THREE.Object3D | null>;
  setActive: (v: boolean) => void;
  dist: number;
};

class SlideshowRegistry {
  private entries = new Map<string, Entry>();

  register(id: string, ref: React.RefObject<THREE.Object3D | null>, setActive: (v: boolean) => void) {
    this.entries.set(id, { id, ref, setActive, dist: Infinity });
  }

  unregister(id: string) {
    this.entries.delete(id);
  }

  list() {
    return [...this.entries.values()];
  }
}

const SlideshowRegistryCtx = createContext<SlideshowRegistry | null>(null);

/** VR only: keep the nearest slideshow panels live to avoid Quest GPU memory exhaustion. */
export const SlideshowActivationManager: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const registry = useMemo(() => new SlideshowRegistry(), []);
  const { camera } = useThree();
  const inXR = useXR(s => !!s.session);
  const tick = useRef(0);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!inXR) return;
    tick.current += 1;
    if (tick.current % 6 !== 0) return;
    const items = registry.list();
    if (!items.length) return;
    for (const e of items) {
      const obj = e.ref.current;
      if (!obj) { e.dist = Infinity; continue; }
      obj.getWorldPosition(worldPos);
      e.dist = worldPos.distanceTo(camera.position);
    }
    const sorted = [...items].sort((a, b) => a.dist - b.dist);
    const activeIds = new Set(
      sorted.filter((e, i) => e.dist < ACTIVE_DIST_VR && i < VR_MAX_ACTIVE).map(e => e.id),
    );
    for (const e of items) {
      e.setActive(activeIds.has(e.id));
    }
  });

  return (
    <SlideshowRegistryCtx.Provider value={registry}>
      {children}
    </SlideshowRegistryCtx.Provider>
  );
};

export const useSlideshowActivation = (id: string, ref: React.RefObject<THREE.Object3D | null>) => {
  const inXR = useXR(s => !!s.session);
  const registry = useContext(SlideshowRegistryCtx);
  const [vrActive, setVrActive] = useState(true);

  useEffect(() => {
    if (!inXR || !registry || !id) {
      setVrActive(true);
      return;
    }
    setVrActive(false);
    registry.register(id, ref, setVrActive);
    return () => {
      registry.unregister(id);
      setVrActive(true);
    };
  }, [inXR, registry, id, ref]);

  if (!inXR || !registry) return true;
  return vrActive;
};

export const slideshowBitmapMaxPx = (inXR: boolean) => (inXR ? 320 : 480);
export const slideshowCanvasWidth = (inXR: boolean) => (inXR ? 480 : 640);
