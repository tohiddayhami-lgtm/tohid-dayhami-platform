import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR, useXRControllerLocomotion } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo } from '../../types';
import { EXPO_DEFAULTS } from './expoUtils';
import { useEnvironmentCollision } from './EnvironmentCollisionContext';
import {
  environmentCollisionEnabled,
  resolveEnvPosition,
} from './expoEnvironmentCollision';
import { LOCO, clampY } from './expoLocomotion';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const readStick = (gp: Gamepad, primary: boolean) => {
  const ax = primary ? (gp.axes[0] ?? 0) : (gp.axes[2] ?? gp.axes[0] ?? 0);
  const ay = primary ? (gp.axes[1] ?? 0) : (gp.axes[3] ?? gp.axes[1] ?? 0);
  return { x: Math.abs(ax) > 0.15 ? ax : 0, y: Math.abs(ay) > 0.15 ? ay : 0 };
};

/** Walk locomotion with Quest thumbsticks (disabled while flying). */
export const VrWalkLocomotion: React.FC<{
  originRef: React.RefObject<THREE.Group | null>;
  enabled: boolean;
}> = ({ originRef, enabled }) => {
  useXRControllerLocomotion(
    originRef,
    enabled ? { speed: 3 } : false,
    enabled ? { type: 'snap', degrees: 30, deadZone: 0.5 } : false,
  );
  return null;
};

/** VR fly + jump — Meta Quest / WebXR gamepads. */
export const VrFlyJumpLocomotion: React.FC<{
  expo: MetaverseExpo;
  originRef: React.RefObject<THREE.Group | null>;
  flyMode: boolean;
  eyeOffsetY?: number;
}> = ({ expo, originRef, flyMode, eyeOffsetY = 0 }) => {
  const session = useXR((s) => s.session);
  const envCollision = useEnvironmentCollision();
  const useEnvCollision = environmentCollisionEnabled(expo) && !flyMode;
  const { camera } = useThree();
  const eye = EXPO_DEFAULTS.eyeHeight;
  const velY = useRef(0);
  const grounded = useRef(true);
  const prevJumpBtn = useRef(false);
  const prevOrigin = useRef<THREE.Vector3 | null>(null);

  useFrame((_, dt) => {
    if (!session || !originRef.current) return;
    const origin = originRef.current;
    const rawDt = Math.min(dt, 0.05);

    if (!prevOrigin.current) {
      prevOrigin.current = origin.position.clone();
      return;
    }

    if (flyMode) {
      let mx = 0, mz = 0, my = 0;
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;
        if (src.handedness === 'left') {
          const s = readStick(gp, true);
          mx = s.x; mz = -s.y;
        } else if (src.handedness === 'right') {
          const s = readStick(gp, true);
          my = -s.y;
          if (gp.buttons[4]?.pressed) my += 1;
          if (gp.buttons[5]?.pressed) my -= 1;
        }
      }
      camera.getWorldDirection(_fwd);
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
      _fwd.normalize();
      _right.crossVectors(_fwd, UP).normalize();
      const speed = LOCO.flySpeed * rawDt;
      const vSpeed = LOCO.flyVerticalSpeed * rawDt;
      origin.position.addScaledVector(_fwd, mz * speed);
      origin.position.addScaledVector(_right, mx * speed);
      origin.position.y += my * vSpeed;
      origin.position.y = clampY(origin.position.y - eyeOffsetY) + eyeOffsetY;
      prevOrigin.current.copy(origin.position);
      return;
    }

    // Walk: jump on A/X (button 4)
    let jumpBtn = false;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (gp?.buttons[4]?.pressed) jumpBtn = true;
    }
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
