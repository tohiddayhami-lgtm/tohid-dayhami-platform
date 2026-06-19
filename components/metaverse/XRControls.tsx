import React, { useEffect } from 'react';
import * as THREE from 'three';
import { XROrigin, createXRStore } from '@react-three/xr';

export type ExpoXRStore = ReturnType<typeof createXRStore>;

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
  useEffect(() => { if (originRef.current) originRef.current.position.y = eyeOffsetY; }, [eyeOffsetY, originRef]);
  return <XROrigin ref={originRef} position={spawn} />;
};

// DOM button to enter immersive VR. Only rendered when the device reports VR support.
export const VRButton: React.FC<{ store: ExpoXRStore; label: string; onBeforeEnter?: () => Promise<void> | void }> = ({ store, label, onBeforeEnter }) => (
  <button
    onClick={async () => { try { await onBeforeEnter?.(); store.enterVR(); } catch { try { store.enterVR(); } catch {} } }}
    className="px-3 py-2 rounded-lg text-sm font-bold bg-white/90 text-gray-900 hover:bg-white flex items-center gap-1.5 shadow"
    title={label}
  >
    🥽 {label}
  </button>
);
