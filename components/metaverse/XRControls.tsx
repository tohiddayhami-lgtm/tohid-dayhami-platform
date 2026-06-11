import React from 'react';
import * as THREE from 'three';
import { XROrigin, useXRControllerLocomotion, createXRStore } from '@react-three/xr';

export type ExpoXRStore = ReturnType<typeof createXRStore>;

// In-canvas WebXR rig: the movable origin (driven by controller thumbstick locomotion) plus
// teleport (the parent mutates originRef.current.position from the floor's TeleportTarget).
export const VrRig: React.FC<{ originRef: React.RefObject<THREE.Group | null>; spawn: [number, number, number] }> = ({ originRef, spawn }) => {
  useXRControllerLocomotion(originRef);
  return <XROrigin ref={originRef} position={spawn} />;
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
