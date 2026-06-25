import React, { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  attachEnvCollisionProxies,
  detachEnvCollisionProxies,
  prepareGltfScene,
} from './prepareGltfScene';

// Loads a GLB/GLTF and renders a clone so the same URL can be reused by several booths.
// Suspends while loading — always render inside a <Suspense> boundary.
export const GltfModel: React.FC<{
  url: string;
  scale?: number;
  /** Target max footprint (max of X/Z bbox) in meters — auto-scales and grounds the model. */
  autoFit?: number;
  /** When false, mesh raycasts are disabled (use an external collider for clicks). */
  pickable?: boolean;
  /** Exhibition hall GLB — lighter rendering + box colliders for walking. */
  forEnvironment?: boolean;
  /** Registers mesh colliders for custom-environment walking (walls / stairs). */
  onCollisionMeshes?: (meshes: THREE.Mesh[]) => void;
}> = ({
  url,
  scale = 1,
  autoFit,
  pickable = true,
  forEnvironment = false,
  onCollisionMeshes,
}) => {
  const { scene } = useGLTF(url);
  const preparedRef = useRef<THREE.Object3D | null>(null);

  const prepared = useMemo(() => {
    if (preparedRef.current) {
      detachEnvCollisionProxies(preparedRef.current);
    }
    const p = prepareGltfScene(scene, {
      autoFit,
      pickable: forEnvironment ? false : pickable,
      shadows: !forEnvironment,
    });
    preparedRef.current = p;
    return p;
  }, [scene, autoFit, pickable, forEnvironment]);

  const collisionProxies = useMemo(() => {
    if (!forEnvironment) return [] as THREE.Mesh[];
    return attachEnvCollisionProxies(prepared);
  }, [prepared, forEnvironment]);

  useEffect(() => {
    if (!onCollisionMeshes) return;
    if (forEnvironment) {
      onCollisionMeshes(collisionProxies);
    } else {
      onCollisionMeshes([]);
    }
    return () => {
      onCollisionMeshes([]);
      if (preparedRef.current) detachEnvCollisionProxies(preparedRef.current);
    };
  }, [collisionProxies, forEnvironment, onCollisionMeshes]);

  return <primitive object={prepared} scale={scale} />;
};
