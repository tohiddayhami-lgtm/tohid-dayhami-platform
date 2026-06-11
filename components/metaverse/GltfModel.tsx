import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Loads a GLB/GLTF and renders a clone so the same URL can be reused by several booths.
// Suspends while loading — always render inside a <Suspense> boundary.
export const GltfModel: React.FC<{ url: string; scale?: number }> = ({ url, scale = 1 }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return c;
  }, [scene]);
  return <primitive object={cloned} scale={scale} />;
};
