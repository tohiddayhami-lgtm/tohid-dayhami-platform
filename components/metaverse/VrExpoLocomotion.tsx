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
import { LOCO, clampY, readVrStick, resolveVrGamepads } from './expoLocomotion';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const SNAP_TURN_RAD = (30 * Math.PI) / 180;
const SNAP_TURN_DEAD = 0.5;

const _euler = new THREE.Euler();

/** Head-yaw basis on the floor — strafe/forward stay horizontal (standard VR locomotion). */
const headFlatBasis = (camera: THREE.Camera, fwd: THREE.Vector3, right: THREE.Vector3) => {
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) {
    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    fwd.set(Math.sin(_euler.y), 0, -Math.cos(_euler.y));
  }
  fwd.normalize();
  right.crossVectors(fwd, UP).normalize();
};

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
  const prevSnapTurnX = useRef(0);

  useFrame((_, dt) => {
    if (!session || !originRef.current) return;
    const origin = originRef.current;
    const rawDt = Math.min(dt, 0.05);

    if (!prevOrigin.current) {
      prevOrigin.current = origin.position.clone();
      return;
    }

    if (flyMode) {
      const { left, right } = resolveVrGamepads(session);
      let mf = 0, ms = 0, mv = 0, turnX = 0;

      if (left) {
        const s = readVrStick(left);
        // Quest: push stick forward → negative Y; match desktop horizontalInput sign.
        mf = -s.y;
        ms = s.x;
      }
      if (right) {
        const s = readVrStick(right);
        mv = -s.y;
        turnX = s.x;
        if (right.buttons[4]?.pressed) mv += 1;
        if (right.buttons[5]?.pressed) mv -= 1;
      }

      // Right-stick snap-turn (same 30° as walk mode).
      if (Math.abs(turnX) > SNAP_TURN_DEAD && Math.abs(prevSnapTurnX.current) <= SNAP_TURN_DEAD) {
        origin.rotation.y -= Math.sign(turnX) * SNAP_TURN_RAD;
      }
      prevSnapTurnX.current = turnX;

      headFlatBasis(camera, _fwd, _right);
      const speed = LOCO.flySpeed * rawDt;
      const vSpeed = LOCO.flyVerticalSpeed * rawDt;
      origin.position.addScaledVector(_fwd, mf * speed);
      origin.position.addScaledVector(_right, ms * speed);
      origin.position.y += mv * vSpeed;
      origin.position.y = clampY(origin.position.y - eyeOffsetY) + eyeOffsetY;
      prevOrigin.current.copy(origin.position);
      return;
    }

    prevSnapTurnX.current = 0;

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
