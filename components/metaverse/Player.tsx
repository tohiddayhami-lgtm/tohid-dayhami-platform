import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, OrbitControls } from '@react-three/drei';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo } from '../../types';
import { hallDims, EXPO_DEFAULTS } from './expoUtils';
import { isTypingElement, resetControlState, type ControlRef, type PlayerPoseRef, type TeleportRef } from './expoControls';
import { useEnvironmentCollision } from './EnvironmentCollisionContext';
import {
  environmentCollisionEnabled,
  resolveEnvPosition,
  resolveEnvTeleport,
  sampleGroundY,
} from './expoEnvironmentCollision';
import {
  LOCO,
  clampY,
  flyDelta,
  horizontalDelta,
  horizontalInput,
  verticalInput,
} from './expoLocomotion';

interface Props {
  expo: MetaverseExpo;
  mode: 'fp' | 'orbit';
  pointerLock: boolean;
  flyMode: boolean;
  controlsPaused?: boolean;
  controlRef: ControlRef;
  poseRef: PlayerPoseRef;
  teleportRef: TeleportRef;
}

const UP = new THREE.Vector3(0, 1, 0);
const _delta = new THREE.Vector3();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const Player: React.FC<Props> = ({
  expo, mode, pointerLock, flyMode, controlsPaused = false, controlRef, poseRef, teleportRef,
}) => {
  const { camera, gl } = useThree();
  const inXR = useXR((s) => !!s.session);
  const envCollision = useEnvironmentCollision();
  const useEnvCollision = environmentCollisionEnabled(expo) && !flyMode;
  const { width, depth } = hallDims(expo);
  const eye = EXPO_DEFAULTS.eyeHeight;
  const startZ = expo.entranceEnabled && !expo.environmentUrl ? depth / 2 + 6.2 : (expo.spawn?.z ?? Math.min(depth / 2 - 2, 8));
  const startRy = expo.entranceEnabled && !expo.environmentUrl ? 0 : (expo.spawn?.ry ?? Math.PI);
  const posRef = useRef(new THREE.Vector3(expo.spawn?.x ?? 0, eye, startZ));
  const yawRef = useRef(startRy);
  const pitchRef = useRef(0);
  const velYRef = useRef(0);
  const groundedRef = useRef(true);

  const collisionMeshes = () => envCollision?.meshesRef.current ?? [];
  const collisionReady = () => !!(useEnvCollision && envCollision?.ready.current && collisionMeshes().length);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.position.copy(posRef.current);
    camera.rotation.set(0, yawRef.current, 0);
    teleportRef.current = (x: number, z: number) => {
      if (flyMode) {
        posRef.current.set(x, posRef.current.y, z);
        return;
      }
      if (collisionReady()) {
        const next = resolveEnvTeleport(collisionMeshes(), x, z, eye, posRef.current.y);
        posRef.current.copy(next);
        velYRef.current = 0;
        groundedRef.current = true;
        return;
      }
      const m = 1.2;
      const maxZ = depth / 2 - m + (expo.entranceEnabled ? 8 : 0);
      posRef.current.set(clamp(x, -width / 2 + m, width / 2 - m), eye, clamp(z, -depth / 2 + m, maxZ));
      velYRef.current = 0;
    };
    return () => { teleportRef.current = null; };
  }, [camera, teleportRef, width, depth, eye, expo.entranceEnabled, useEnvCollision, envCollision, flyMode]);

  useEffect(() => {
    if (controlsPaused) resetControlState(controlRef.current);
  }, [controlsPaused, controlRef]);

  useEffect(() => {
    velYRef.current = 0;
    groundedRef.current = true;
  }, [flyMode]);

  useEffect(() => {
    const k = controlRef.current.keys;
    const blocked = (e: KeyboardEvent) => controlsPaused || isTypingElement(e.target as Element) || isTypingElement(document.activeElement);
    const setKey = (code: string, v: boolean) => {
      switch (code) {
        case 'KeyW': case 'ArrowUp': k.forward = v; break;
        case 'KeyS': case 'ArrowDown': k.back = v; break;
        case 'KeyA': case 'ArrowLeft': k.left = v; break;
        case 'KeyD': case 'ArrowRight': k.right = v; break;
        case 'ShiftLeft': case 'ShiftRight': controlRef.current.run = v; break;
        case 'Space': k.up = v; break;
        case 'ControlLeft': case 'ControlRight': case 'KeyC': k.down = v; break;
      }
    };
    const down = (e: KeyboardEvent) => {
      if (blocked(e)) return;
      if (!flyMode && e.code === 'Space' && !e.repeat) {
        controlRef.current.jumpPulse = true;
      }
      setKey(e.code, true);
    };
    const up = (e: KeyboardEvent) => setKey(e.code, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [controlRef, controlsPaused, flyMode]);

  useEffect(() => {
    if (pointerLock || mode === 'orbit' || controlsPaused) return;
    const el = gl.domElement;
    let dragging = false, lastX = 0, lastY = 0;
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      controlRef.current.yawDelta += dx * 0.0026;
      controlRef.current.pitchDelta += dy * 0.0026;
    };
    const onUp = () => { dragging = false; };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [gl, controlRef, pointerLock, mode, controlsPaused]);

  useFrame((_, dtRaw) => {
    if (inXR) return;
    const dt = Math.min(dtRaw, 0.05);
    const c = controlRef.current;
    if (controlsPaused) {
      resetControlState(c);
      return;
    }

    if (mode === 'orbit') {
      posRef.current.copy(camera.position);
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      poseRef.current = { x: camera.position.x, z: camera.position.z, heading: Math.atan2(-d.x, -d.z), y: camera.position.y };
      return;
    }

    const LOOK = 2.4;
    if (Math.abs(c.look.x) > 0.08) c.yawDelta += c.look.x * LOOK * dt;
    if (Math.abs(c.look.y) > 0.08) c.pitchDelta += c.look.y * LOOK * dt;

    if (!pointerLock) {
      yawRef.current -= c.yawDelta;
      pitchRef.current = clamp(pitchRef.current - c.pitchDelta, flyMode ? -1.55 : -1.3, flyMode ? 1.55 : 1.3);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(pitchRef.current, yawRef.current, 0);
    }
    c.yawDelta = 0; c.pitchDelta = 0;

    const { mf, ms } = horizontalInput(c);
    const mv = verticalInput(c);

    if (flyMode) {
      const speed = (c.run ? LOCO.flySpeed * 1.35 : LOCO.flySpeed);
      if (mf || ms || mv) {
        flyDelta(camera, mf, ms, mv, speed, LOCO.flyVerticalSpeed, dt, _delta);
        posRef.current.add(_delta);
        posRef.current.y = clampY(posRef.current.y);
      }
      c.jumpPulse = false;
    } else {
      if (c.jumpPulse && groundedRef.current) {
        velYRef.current = LOCO.jumpSpeed;
        groundedRef.current = false;
      }
      c.jumpPulse = false;

      if (mf || ms) {
        const speed = (c.run ? LOCO.runSpeed : LOCO.walkSpeed);
        horizontalDelta(camera, mf, ms, speed, dt, _delta);
        const dx = _delta.x;
        const dz = _delta.z;

        if (collisionReady()) {
          const next = resolveEnvPosition(collisionMeshes(), posRef.current, eye, dx, dz);
          posRef.current.x = next.x;
          posRef.current.z = next.z;
          if (groundedRef.current) posRef.current.y = next.y;
        } else {
          posRef.current.x += dx;
          posRef.current.z += dz;
          const m = 1.2;
          posRef.current.x = clamp(posRef.current.x, -width / 2 + m, width / 2 - m);
          posRef.current.z = clamp(posRef.current.z, -depth / 2 + m, depth / 2 + m + (expo.entranceEnabled ? 8 : 0));
          if (groundedRef.current) posRef.current.y = eye;
        }
      }

      if (!groundedRef.current || velYRef.current !== 0) {
        velYRef.current -= LOCO.gravity * dt;
        posRef.current.y += velYRef.current * dt;

        const feetY = posRef.current.y - eye;
        let groundY: number | null = null;
        if (collisionReady()) {
          groundY = sampleGroundY(collisionMeshes(), posRef.current.x, posRef.current.z, posRef.current.y + 2);
        } else {
          groundY = 0;
        }
        const targetY = groundY != null ? groundY + eye : eye;
        if (posRef.current.y <= targetY + 0.05) {
          posRef.current.y = targetY;
          velYRef.current = 0;
          groundedRef.current = true;
        } else {
          groundedRef.current = false;
        }
      } else if (collisionReady()) {
        const next = resolveEnvPosition(collisionMeshes(), posRef.current, eye, 0, 0);
        if (Math.abs(next.y - posRef.current.y) > 0.02) posRef.current.y = next.y;
      } else {
        posRef.current.y = eye;
      }
    }

    camera.position.copy(posRef.current);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    poseRef.current = {
      x: posRef.current.x,
      z: posRef.current.z,
      heading: Math.atan2(-dir.x, -dir.z),
      y: posRef.current.y,
    };
  });

  if (mode === 'orbit') {
    return <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={2} maxDistance={Math.max(width, depth)} target={[0, 1, 0]} />;
  }
  if (pointerLock && !controlsPaused) return <PointerLockControls makeDefault />;
  return null;
};
