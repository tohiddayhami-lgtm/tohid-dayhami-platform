import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { XROrigin, useXRControllerLocomotion, createXRStore } from '@react-three/xr';

export type ExpoXRStore = ReturnType<typeof createXRStore>;

// Comfort vignette: a black tunnel locked to the headset that fades in while the user is gliding
// and fades out when they stop. Shrinking peripheral vision during self-motion is the standard
// remedy for VR motion sickness / eye strain — the centre of view stays fully clear. Teleport
// jumps (instant, large position deltas) are ignored so they don't flash the vignette.
const ComfortVignette: React.FC<{ originRef: React.RefObject<THREE.Group | null> }> = ({ originRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const last = useRef(new THREE.Vector3());
  const have = useRef(false);
  const smooth = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, dt) => {
    const mesh = meshRef.current, mat = matRef.current;
    if (!mesh || !mat) return;
    const xr: any = state.gl.xr;
    if (!xr?.isPresenting) { mesh.visible = false; smooth.current = 0; have.current = false; return; }

    // Glide speed = how fast the locomotion origin is translating (ignore teleport-sized jumps).
    const o = originRef.current;
    let speed = 0;
    if (o) {
      if (have.current) { const d = o.position.distanceTo(last.current); speed = d > 1.2 ? 0 : d / Math.max(dt, 1e-3); }
      last.current.copy(o.position); have.current = true;
    }
    // Ramp opacity from 0 (≤0.6 m/s) to a gentle 0.5 (≥2.2 m/s); ease toward the target so it never snaps.
    const target = THREE.MathUtils.clamp((speed - 0.6) / 1.6, 0, 1) * 0.5;
    smooth.current += (target - smooth.current) * Math.min(1, dt * 8);
    mat.opacity = smooth.current;
    mesh.visible = smooth.current > 0.01;
    if (!mesh.visible) return;

    // Billboard the tunnel a fixed distance in front of the head, facing the viewer.
    const cam = xr.getCamera();
    cam.getWorldPosition(tmp);
    cam.getWorldQuaternion(q);
    fwd.set(0, 0, -1).applyQuaternion(q);
    mesh.position.copy(tmp).addScaledVector(fwd, 0.6);
    mesh.quaternion.copy(q);
  });

  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false} visible={false}>
      {/* clear hole over the wide central ~85° of view, soft black only at the far periphery */}
      <ringGeometry args={[0.55, 3, 48]} />
      <meshBasicMaterial ref={matRef} color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

// In-canvas WebXR rig: the movable origin (driven by controller thumbstick locomotion) plus
// teleport (the parent mutates originRef.current.position from the floor's TeleportTarget).
//
// Tuned for a Meta Quest 3 merchant walking an exhibition hall:
//  • Left stick → brisk, head-relative glide (3 m/s vs. the slow ~1 m/s default) so crossing the
//    hall and approaching booths feels natural.
//  • Right stick → comfortable 30° snap-turn (with a dead-zone) — responsive for looking around
//    booth-to-booth while minimising motion sickness vs. smooth spinning.
// `eyeOffsetY` raises the origin so a SEATED visitor sees the hall at standing eye-level
// (0 = standing / room-scale; ~0.55 = seated).
export const VrRig: React.FC<{ originRef: React.RefObject<THREE.Group | null>; spawn: [number, number, number]; eyeOffsetY?: number }> = ({ originRef, spawn, eyeOffsetY = 0 }) => {
  useXRControllerLocomotion(
    originRef,
    { speed: 3 },
    { type: 'snap', degrees: 30, deadZone: 0.5 },
  );
  // Apply the seated/standing height offset without resetting the X/Z position the locomotion
  // hook is driving each frame.
  useEffect(() => { if (originRef.current) originRef.current.position.y = eyeOffsetY; }, [eyeOffsetY, originRef]);
  return (
    <>
      <XROrigin ref={originRef} position={spawn} />
      <ComfortVignette originRef={originRef} />
    </>
  );
};

// DOM button to enter immersive VR. Only rendered when the device reports VR support.
export const VRButton: React.FC<{ store: ExpoXRStore; label: string }> = ({ store, label }) => (
  <button
    onClick={() => { try { store.enterVR(); } catch {} }}
    className="px-3 py-2 rounded-lg text-sm font-bold bg-white/90 text-gray-900 hover:bg-white flex items-center gap-1.5 shadow"
    title={label}
  >
    🥽 {label}
  </button>
);
