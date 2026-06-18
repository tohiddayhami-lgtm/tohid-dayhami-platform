import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Loads a GLB/GLTF and renders a clone so the same URL can be reused by several booths.
// Suspends while loading — always render inside a <Suspense> boundary.
export const GltfModel: React.FC<{
  url: string;
  scale?: number;
  /** Target max footprint (max of X/Z bbox) in meters — auto-scales and grounds the model. */
  autoFit?: number;
}> = ({ url, scale = 1, autoFit }) => {
  const { scene } = useGLTF(url);
  const prepared = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (autoFit && autoFit > 0) {
      const box = new THREE.Box3().setFromObject(c);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      c.position.sub(center);
      const footprint = Math.max(size.x, size.z, 0.0001);
      c.scale.setScalar(autoFit / footprint);
      const grounded = new THREE.Box3().setFromObject(c);
      c.position.y -= grounded.min.y;
    }
    return c;
  }, [scene, autoFit]);
  return <primitive object={prepared} scale={scale} />;
};
