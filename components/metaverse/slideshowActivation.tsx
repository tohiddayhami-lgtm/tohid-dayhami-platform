import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';

const VR_MAX_ACTIVE = 5;
const DESKTOP_MAX_ACTIVE = 16;
const ACTIVE_DIST_VR = 32;
const ACTIVE_DIST_DESKTOP = 36;

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

/** One useFrame loop picks the nearest slideshow panels to keep live (VRAM-safe in VR). */
export const SlideshowActivationManager: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const registry = useMemo(() => new SlideshowRegistry(), []);
  const { camera } = useThree();
  const inXR = useXR(s => !!s.session);
  const tick = useRef(0);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    tick.current += 1;
    if (tick.current % (inXR ? 8 : 20) !== 0) return;
    const items = registry.list();
    if (!items.length) return;
    const maxDist = inXR ? ACTIVE_DIST_VR : ACTIVE_DIST_DESKTOP;
    const maxActive = inXR ? VR_MAX_ACTIVE : DESKTOP_MAX_ACTIVE;
    for (const e of items) {
      const obj = e.ref.current;
      if (!obj) { e.dist = Infinity; continue; }
      obj.getWorldPosition(worldPos);
      e.dist = worldPos.distanceTo(camera.position);
    }
    const sorted = [...items].sort((a, b) => a.dist - b.dist);
    const activeIds = new Set(
      sorted.filter((e, i) => e.dist < maxDist && i < maxActive).map(e => e.id),
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
  const registry = useContext(SlideshowRegistryCtx);
  const [active, setActive] = useState(() => !registry);

  useEffect(() => {
    if (!registry || !id) return;
    registry.register(id, ref, setActive);
    return () => registry.unregister(id);
  }, [registry, id, ref]);

  return registry ? active : true;
};

export const slideshowBitmapMaxPx = (inXR: boolean) => (inXR ? 320 : 480);
export const slideshowCanvasWidth = (inXR: boolean) => (inXR ? 480 : 640);
