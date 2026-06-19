import React, { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { collectMeshes, prepareGltfScene } from './prepareGltfScene';

// Loads a GLB/GLTF and renders a clone so the same URL can be reused by several booths.
// Suspends while loading — always render inside a <Suspense> boundary.
export const GltfModel: React.FC<{
  url: string;
  scale?: number;
  /** Target max footprint (max of X/Z bbox) in meters — auto-scales and grounds the model. */
  autoFit?: number;
  /** When false, mesh raycasts are disabled (use an external collider for clicks). */
  pickable?: boolean;
  /** Registers mesh colliders for custom-environment walking (walls / stairs). */
  onCollisionMeshes?: (meshes: THREE.Mesh[]) => void;
}> = ({ url, scale = 1, autoFit, pickable = true, onCollisionMeshes }) => {
  const { scene } = useGLTF(url);
  const prepared = useMemo(
    () => prepareGltfScene(scene, { autoFit, pickable }),
    [scene, autoFit, pickable],
  );

  useEffect(() => {
    if (!onCollisionMeshes) return;
    onCollisionMeshes(collectMeshes(prepared));
    return () => onCollisionMeshes([]);
  }, [prepared, onCollisionMeshes]);

  return <primitive object={prepared} scale={scale} />;
};
