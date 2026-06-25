import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR, useXRControllerLocomotion, useXRStore } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo } from '../../types';
import { EXPO_DEFAULTS } from './expoUtils';
import { useEnvironmentCollision } from './EnvironmentCollisionContext';
import {
  environmentCollisionEnabled,
  resolveEnvPosition,
} from './expoEnvironmentCollision';
import {
  LOCO,
  clampY,
  getXrController,
  isXrButtonPressed,
  readXrThumbstick,
  XR_PRIMARY_BTN,
  XR_SECONDARY_BTN,
} from './expoLocomotion';

const SNAP_TURN_DEAD = 0.5;

/** Walk locomotion with Quest thumbsticks — mount only while not flying (see MetaverseExpoView). */
export const VrWalkLocomotion: React.FC<{
  originRef: React.RefObject<THREE.Group | null>;
}> = ({ originRef }) => {
  useXRControllerLocomotion(
    originRef,
    { speed: 3 },
    { type: 'snap', degrees: 30, deadZone: SNAP_TURN_DEAD },
  );
  return null;
};

/** VR fly — uses @pmndrs/xr thumbstick mapping (Quest 3 compatible). Mount only in fly mode. */
export const VrFlyLocomotion: React.FC<{
  originRef: React.RefObject<THREE.Group | null>;
  eyeOffsetY?: number;
}> = ({ originRef, eyeOffsetY = 0 }) => {
  const store = useXRStore();

  useXRControllerLocomotion(
    (velocity, rotationVelocityY, deltaTime) => {
      const origin = originRef.current;
      if (!origin) return;

      origin.position.x += velocity.x * deltaTime;
      origin.position.z += velocity.z * deltaTime;
      origin.rotation.y += rotationVelocityY;

      const { inputSourceStates } = store.getState();
      const right = getXrController(inputSourceStates as any, 'right');
      const left = getXrController(inputSourceStates as any, 'left');
      const rs = readXrThumbstick(right);

      let mv = -rs.y;
      if (isXrButtonPressed(right, XR_PRIMARY_BTN)) mv += 1;
      if (isXrButtonPressed(right, XR_SECONDARY_BTN)) mv -= 1;
      if (isXrButtonPressed(left, XR_PRIMARY_BTN)) mv += 1;
      if (isXrButtonPressed(left, XR_SECONDARY_BTN)) mv -= 1;

      origin.position.y += mv * LOCO.flyVerticalSpeed * deltaTime;
      origin.position.y = clampY(origin.position.y - eyeOffsetY) + eyeOffsetY;
    },
    { speed: LOCO.flySpeed },
    { type: 'snap', degrees: 30, deadZone: SNAP_TURN_DEAD },
  );

  return null;
};

/** Toggle fly/walk with left controller Y button (Quest secondary) in VR. */
export const VrFlyModeToggle: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const session = useXR((s) => s.session);
  const store = useXRStore();
  const prev = useRef(false);

  useFrame(() => {
    if (!session) return;
    const left = getXrController(store.getState().inputSourceStates as any, 'left');
    const pressed = isXrButtonPressed(left, XR_SECONDARY_BTN);
    if (pressed && !prev.current) onToggle();
    prev.current = pressed;
  });

  return null;
};

/** VR jump while walking — A/X (primary) on either controller. */
export const VrFlyJumpLocomotion: React.FC<{
  expo: MetaverseExpo;
  originRef: React.RefObject<THREE.Group | null>;
  flyMode: boolean;
  eyeOffsetY?: number;
}> = ({ expo, originRef, flyMode, eyeOffsetY = 0 }) => {
  const session = useXR((s) => s.session);
  const store = useXRStore();
  const envCollision = useEnvironmentCollision();
  const useEnvCollision = environmentCollisionEnabled(expo) && !flyMode;
  const eye = EXPO_DEFAULTS.eyeHeight;
  const velY = useRef(0);
  const grounded = useRef(true);
  const prevJumpBtn = useRef(false);
  const prevOrigin = useRef<THREE.Vector3 | null>(null);

  useFrame((_, dt) => {
    if (!session || !originRef.current || flyMode) return;
    const origin = originRef.current;
    const rawDt = Math.min(dt, 0.05);

    if (!prevOrigin.current) {
      prevOrigin.current = origin.position.clone();
      return;
    }

    const { inputSourceStates } = store.getState();
    const left = getXrController(inputSourceStates as any, 'left');
    const right = getXrController(inputSourceStates as any, 'right');
    const jumpBtn =
      isXrButtonPressed(left, XR_PRIMARY_BTN)
      || isXrButtonPressed(right, XR_PRIMARY_BTN);

    if (jumpBtn && !prevJumpBtn.current && grounded.current) {
      velY.current = LOCO.jumpSpeed;
      grounded.current = false;
    }
    prevJumpBtn.current = jumpBtn;

    if (!grounded.current || velY.current !== 0) {
      velY.current -= LOCO.gravity * rawDt;
      origin.position.y += velY.current * rawDt;
      const floorY = eyeOffsetY;
      if (origin.position.y <= floorY + 0.04) {
        origin.position.y = floorY;
        velY.current = 0;
        grounded.current = true;
      }
    }

    if (useEnvCollision && envCollision?.ready.current && envCollision.meshesRef.current.length) {
      const dx = origin.position.x - prevOrigin.current.x;
      const dz = origin.position.z - prevOrigin.current.z;
      if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
        const pos = new THREE.Vector3(prevOrigin.current.x, prevOrigin.current.y + eye - eyeOffsetY, prevOrigin.current.z);
        const next = resolveEnvPosition(envCollision.meshesRef.current, pos, eye, dx, dz);
        origin.position.x = next.x;
        origin.position.z = next.z;
        if (grounded.current) origin.position.y = next.y - eye + eyeOffsetY;
      }
    }

    prevOrigin.current.copy(origin.position);
  });

  return null;
};
