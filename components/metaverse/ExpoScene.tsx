import React, { Suspense } from 'react';
import { Environment, Sky, ContactShadows, Grid } from '@react-three/drei';
import { TeleportTarget } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo, MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { hallDims, EXPO_DEFAULTS } from './expoUtils';
import { Booth } from './Booth';
import { GltfModel } from './GltfModel';

interface Props {
  expo: MetaverseExpo;
  lang: Language;
  onSelectHotspot: (h: MetaverseHotspot) => void;
  onSelectBooth: (b: MetaverseBooth) => void;
  onFloorTeleport: (x: number, z: number) => void;   // desktop double-click teleport
  onVrTeleport: (v: THREE.Vector3) => void;           // WebXR controller teleport
}

const Wall: React.FC<{ args: [number, number, number]; position: [number, number, number]; color: string }> = ({ args, position, color }) => (
  <mesh position={position} receiveShadow castShadow>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} side={THREE.DoubleSide} />
  </mesh>
);

// The full 3D environment: image-based lighting, sky, floor + perimeter walls sized to the
// hall dimensions, an optional custom environment GLB, and every booth.
export const ExpoScene: React.FC<Props> = ({ expo, lang, onSelectHotspot, onSelectBooth, onFloorTeleport, onVrTeleport }) => {
  const { width, depth, height } = hallDims(expo);
  const ground = expo.groundColor || EXPO_DEFAULTS.groundColor;
  const wall = expo.wallColor || EXPO_DEFAULTS.wallColor;
  const t = 0.2; // wall thickness

  return (
    <>
      {/* Lighting — fully procedural so the hall is lit instantly with NO network fetch.
          (A multi-MB HDR is only loaded when the admin explicitly sets a skybox URL below.) */}
      <ambientLight intensity={0.75} />
      <hemisphereLight intensity={0.7} groundColor={ground} color="#ffffff" />
      <directionalLight
        position={[width * 0.3, height * 2, depth * 0.3]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={Math.max(width, depth) * 2}
        shadow-camera-left={-width} shadow-camera-right={width}
        shadow-camera-top={depth} shadow-camera-bottom={-depth}
      />

      {/* Procedural sky background (instant). A custom HDR is loaded only when provided. */}
      {expo.skyboxUrl ? (
        <Suspense fallback={null}>
          <Environment files={expo.skyboxUrl} background />
        </Suspense>
      ) : (
        <Sky distance={450000} sunPosition={[10, 8, 5]} turbidity={6} rayleigh={1.2} />
      )}

      {/* Floor (also the teleport target for both desktop double-click and WebXR) */}
      <TeleportTarget onTeleport={(v: THREE.Vector3) => onVrTeleport(v)}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
          onDoubleClick={(e) => { e.stopPropagation(); onFloorTeleport(e.point.x, e.point.z); }}
        >
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color={ground} />
        </mesh>
      </TeleportTarget>
      <Grid args={[width, depth]} cellSize={1} cellThickness={0.5} sectionSize={5} sectionThickness={1} sectionColor="#9aa3b2" cellColor="#c2c8d2" fadeDistance={Math.max(width, depth) * 1.2} position={[0, 0.01, 0]} infiniteGrid={false} />
      <ContactShadows position={[0, 0.02, 0]} scale={Math.max(width, depth)} blur={2} opacity={0.4} far={6} frames={1} />

      {/* Perimeter walls */}
      <Wall args={[width, height, t]} position={[0, height / 2, -depth / 2]} color={wall} />
      <Wall args={[width, height, t]} position={[0, height / 2, depth / 2]} color={wall} />
      <Wall args={[t, height, depth]} position={[-width / 2, height / 2, 0]} color={wall} />
      <Wall args={[t, height, depth]} position={[width / 2, height / 2, 0]} color={wall} />

      {/* Optional custom environment / hall GLB */}
      {expo.environmentUrl && (
        <Suspense fallback={null}>
          <GltfModel url={expo.environmentUrl} />
        </Suspense>
      )}

      {/* Booths */}
      {(expo.booths || []).map(b => (
        <Booth key={b.id} booth={b} lang={lang} onSelectHotspot={onSelectHotspot} onSelectBooth={onSelectBooth} />
      ))}
    </>
  );
};
