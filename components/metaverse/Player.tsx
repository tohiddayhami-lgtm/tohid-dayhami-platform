import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, OrbitControls } from '@react-three/drei';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo } from '../../types';
import { hallDims, EXPO_DEFAULTS } from './expoUtils';
import type { ControlRef, PlayerPoseRef, TeleportRef } from './expoControls';

interface Props {
  expo: MetaverseExpo;
  mode: 'fp' | 'orbit';
  pointerLock: boolean;
  controlRef: ControlRef;
  poseRef: PlayerPoseRef;
  teleportRef: TeleportRef;
}

const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Owns the non-VR camera: walk (WASD / joystick), look (drag or pointer-lock), orbit overview,
// and double-click teleport. When a WebXR session is active it yields fully to the headset.
export const Player: React.FC<Props> = ({ expo, mode, pointerLock, controlRef, poseRef, teleportRef }) => {
  const { camera, gl } = useThree();
  const inXR = useXR((s) => !!s.session);
  const { width, depth } = hallDims(expo);
  const eye = EXPO_DEFAULTS.eyeHeight;
  const posRef = useRef(new THREE.Vector3(expo.spawn?.x ?? 0, eye, expo.spawn?.z ?? Math.min(depth / 2 - 2, 8)));
  const yawRef = useRef(expo.spawn?.ry ?? Math.PI);
  const pitchRef = useRef(0);

  // Initial camera placement + expose teleport to the outside world (floor double-click).
  useEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.position.copy(posRef.current);
    camera.rotation.set(0, yawRef.current, 0);
    teleportRef.current = (x: number, z: number) => {
      const m = 1.2;
      posRef.current.set(clamp(x, -width / 2 + m, width / 2 - m), eye, clamp(z, -depth / 2 + m, depth / 2 - m));
    };
    return () => { teleportRef.current = null; };
  }, [camera, teleportRef, width, depth, eye]);

  // Keyboard (desktop)
  useEffect(() => {
    const k = controlRef.current.keys;
    const set = (code: string, v: boolean) => {
      switch (code) {
        case 'KeyW': case 'ArrowUp': k.forward = v; break;
        case 'KeyS': case 'ArrowDown': k.back = v; break;
        case 'KeyA': case 'ArrowLeft': k.left = v; break;
        case 'KeyD': case 'ArrowRight': k.right = v; break;
        case 'ShiftLeft': case 'ShiftRight': controlRef.current.run = v; break;
      }
    };
    const down = (e: KeyboardEvent) => set(e.code, true);
    const up = (e: KeyboardEvent) => set(e.code, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [controlRef]);

  // Drag-look (desktop / mobile) — disabled while PointerLockControls owns the mouse.
  useEffect(() => {
    if (pointerLock || mode === 'orbit') return;
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
  }, [gl, controlRef, pointerLock, mode]);

  useFrame((_, dtRaw) => {
    if (inXR) return;                       // headset controls the camera in VR
    const dt = Math.min(dtRaw, 0.05);
    const c = controlRef.current;

    if (mode === 'orbit') {
      // OrbitControls owns the camera; keep posRef + pose in sync for a smooth return to FP.
      posRef.current.copy(camera.position);
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      poseRef.current = { x: camera.position.x, z: camera.position.z, heading: Math.atan2(-d.x, -d.z) };
      return;
    }

    // Continuous turn from the mobile LOOK joystick (deadzone, then proportional rad/sec).
    const LOOK = 2.4;
    if (Math.abs(c.look.x) > 0.08) c.yawDelta += c.look.x * LOOK * dt;
    if (Math.abs(c.look.y) > 0.08) c.pitchDelta += c.look.y * LOOK * dt;

    // Look — apply drag + joystick deltas unless PointerLockControls is steering.
    if (!pointerLock) {
      yawRef.current -= c.yawDelta;
      pitchRef.current = clamp(pitchRef.current - c.pitchDelta, -1.3, 1.3);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(pitchRef.current, yawRef.current, 0);
    }
    c.yawDelta = 0; c.pitchDelta = 0;

    // Movement relative to where the camera looks (projected onto the ground).
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const mf = (c.keys.forward ? 1 : 0) - (c.keys.back ? 1 : 0) - c.joy.y;
    const ms = (c.keys.right ? 1 : 0) - (c.keys.left ? 1 : 0) + c.joy.x;
    if (mf || ms) {
      const speed = (c.run ? 6 : 3.2) * dt;
      posRef.current.addScaledVector(dir, mf * speed);
      posRef.current.addScaledVector(right, ms * speed);
      const m = 1.2;
      posRef.current.x = clamp(posRef.current.x, -width / 2 + m, width / 2 - m);
      posRef.current.z = clamp(posRef.current.z, -depth / 2 + m, depth / 2 - m);
    }
    posRef.current.y = eye;
    camera.position.copy(posRef.current);
    poseRef.current = { x: posRef.current.x, z: posRef.current.z, heading: Math.atan2(-dir.x, -dir.z) };
  });

  if (mode === 'orbit') {
    return <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={2} maxDistance={Math.max(width, depth)} target={[0, 1, 0]} />;
  }
  if (pointerLock) return <PointerLockControls makeDefault />;
  return null;
};
