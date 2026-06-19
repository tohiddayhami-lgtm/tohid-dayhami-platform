import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo } from '../../types';
import { EXPO_DEFAULTS } from './expoUtils';
import { useEnvironmentCollision } from './EnvironmentCollisionContext';
import {
  environmentCollisionEnabled,
  resolveEnvPosition,
  syncCollisionMatrices,
} from './expoEnvironmentCollision';

const _pos = new THREE.Vector3();

/** Keeps WebXR thumbstick locomotion inside environment walls and on stairs/floors. */
export const VrEnvironmentCollision: React.FC<{
  expo: MetaverseExpo;
  originRef: React.RefObject<THREE.Group | null>;
  eyeOffsetY?: number;
}> = ({ expo, originRef, eyeOffsetY = 0 }) => {
  const inXR = useXR((s) => !!s.session);
  const envCollision = useEnvironmentCollision();
  const useEnvCollision = environmentCollisionEnabled(expo);
  const eye = EXPO_DEFAULTS.eyeHeight;
  const prevOrigin = useRef<THREE.Vector3 | null>(null);

  useFrame(() => {
    if (!inXR || !useEnvCollision || !envCollision?.ready.current) return;
    const origin = originRef.current;
    const meshes = envCollision.meshesRef.current;
    if (!origin || !meshes.length) return;

    if (!prevOrigin.current) {
      prevOrigin.current = origin.position.clone();
      return;
    }

    syncCollisionMatrices(envCollision.rootRef.current);
    const dx = origin.position.x - prevOrigin.current.x;
    const dz = origin.position.z - prevOrigin.current.z;

    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
      _pos.set(prevOrigin.current.x, prevOrigin.current.y, prevOrigin.current.z);
      const next = resolveEnvPosition(meshes, _pos, eye, dx, dz);
      origin.position.x = next.x;
      origin.position.z = next.z;
      origin.position.y = next.y + eyeOffsetY;
    } else if (envCollision.ready.current) {
      _pos.copy(origin.position);
      _pos.y -= eyeOffsetY;
      const snapped = resolveEnvPosition(meshes, _pos, eye, 0, 0);
      if (Math.abs(snapped.y - _pos.y) > 0.002) {
        origin.position.y = snapped.y + eyeOffsetY;
      }
    }

    prevOrigin.current.copy(origin.position);
  });

  return null;
};
