import React, { Suspense } from 'react';
import { Environment, Sky, Grid } from '@react-three/drei';
import { TeleportTarget } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaverseExpo, MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { hallDims, EXPO_DEFAULTS, wallTransform } from './expoUtils';
import { Booth, TexBoundary } from './Booth';
import { GltfModel } from './GltfModel';
import { WallAd, PresentationScreen } from './WallMedia';
import { bi } from './expoUtils';

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

// Ceiling + a regular grid of glowing light panels, so the hall reads as a real lit exhibition
// space rather than an open box. Pure emissive planes (no extra real lights → cheap).
const Ceiling: React.FC<{ width: number; depth: number; height: number }> = ({ width, depth, height }) => {
  const cols = Math.max(2, Math.round(width / 6));
  const rows = Math.max(2, Math.round(depth / 6));
  const panels: { x: number; z: number }[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    panels.push({ x: (i - (cols - 1) / 2) * (width / cols), z: (j - (rows - 1) / 2) * (depth / rows) });
  }
  const pw = (width / cols) * 0.5, pd = (depth / rows) * 0.5;
  return (
    <group>
      {/* White, lightly-glossy exhibition ceiling slab */}
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f5f7fa" roughness={0.45} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Soft recessed light panels (warm white, gentle glow — reads as ceiling fixtures) */}
      {panels.map((p, i) => (
        <mesh key={i} position={[p.x, height - 0.05, p.z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[pw, pd]} />
          <meshStandardMaterial color="#ffffff" emissive={'#fff6e8'} emissiveIntensity={0.85} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

// The full 3D environment: image-based lighting, sky, floor + perimeter walls sized to the
// hall dimensions, an optional custom environment GLB, and every booth.
export const ExpoScene: React.FC<Props> = ({ expo, lang, onSelectHotspot, onSelectBooth, onFloorTeleport, onVrTeleport }) => {
  const { width, depth, height } = hallDims(expo);
  const ground = expo.groundColor || EXPO_DEFAULTS.groundColor;
  const wall = expo.wallColor || EXPO_DEFAULTS.wallColor;
  const t = 0.2; // wall thickness

  return (
    <>
      {/* Lighting — flat & even (no shadows), so every booth is lit identically. Fully procedural
          so the hall is lit instantly with NO network fetch. */}
      <ambientLight intensity={1.15} />
      <hemisphereLight intensity={0.9} groundColor="#ffffff" color="#ffffff" />
      {/* Two soft, opposing, shadow-less fills cancel out directional darkening on any booth. */}
      <directionalLight position={[width, height * 2, depth]} intensity={0.45} />
      <directionalLight position={[-width, height * 2, -depth]} intensity={0.45} />

      {/* Procedural sky background (instant). A custom HDR is loaded only when provided. */}
      {expo.skyboxUrl ? (
        <TexBoundary key={expo.skyboxUrl}>
          <Suspense fallback={null}>
            <Environment files={expo.skyboxUrl} background />
          </Suspense>
        </TexBoundary>
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

      {/* Perimeter walls */}
      <Wall args={[width, height, t]} position={[0, height / 2, -depth / 2]} color={wall} />
      <Wall args={[width, height, t]} position={[0, height / 2, depth / 2]} color={wall} />
      <Wall args={[t, height, depth]} position={[-width / 2, height / 2, 0]} color={wall} />
      <Wall args={[t, height, depth]} position={[width / 2, height / 2, 0]} color={wall} />

      {/* Dark baseboard trim around the room for a finished look */}
      <Wall args={[width, 0.25, t + 0.02]} position={[0, 0.125, -depth / 2 + 0.01]} color="#3a4150" />
      <Wall args={[width, 0.25, t + 0.02]} position={[0, 0.125, depth / 2 - 0.01]} color="#3a4150" />
      <Wall args={[t + 0.02, 0.25, depth]} position={[-width / 2 + 0.01, 0.125, 0]} color="#3a4150" />
      <Wall args={[t + 0.02, 0.25, depth]} position={[width / 2 - 0.01, 0.125, 0]} color="#3a4150" />

      {/* Ceiling with glowing light panels */}
      <Ceiling width={width} depth={depth} height={height} />
      {/* Soft warm fill from the ceiling lights (no shadows → cheap) */}
      <pointLight position={[width * 0.25, height - 0.4, depth * 0.25]} intensity={0.5} distance={Math.max(width, depth)} color="#fff3df" />
      <pointLight position={[-width * 0.25, height - 0.4, -depth * 0.25]} intensity={0.5} distance={Math.max(width, depth)} color="#fff3df" />

      {/* Optional custom environment / hall GLB */}
      {expo.environmentUrl && (
        <TexBoundary key={expo.environmentUrl}>
          <Suspense fallback={null}>
            <GltfModel url={expo.environmentUrl} />
          </Suspense>
        </TexBoundary>
      )}

      {/* Environmental advertising banners — auto-distributed along each wall, height auto-fit. */}
      {(() => {
        const dims = { width, depth, height };
        const adScale = expo.wallAdScale ?? 1.35;
        const adLift = expo.wallAdLift ?? 2;
        const byWall: Record<string, typeof expo.wallAds> = {};
        (expo.wallAds || []).forEach(a => { (byWall[a.wall] = byWall[a.wall] || []).push(a); });
        const out: React.ReactElement[] = [];
        Object.keys(byWall).forEach(wall => {
          const list = byWall[wall]!;
          list.forEach((ad, i) => {
            const w = (ad.w || 3) * adScale, h = (ad.h || 2) * adScale;
            const u = (i + 1) / (list.length + 1);                                   // even spacing along the wall
            const yc = Math.min(height - h / 2 - 0.4, Math.max(h / 2 + 1.0, height * 0.55 + adLift)); // comfortable height
            const { position, rotation } = wallTransform(wall as 'back' | 'left' | 'right' | 'front', u, yc / height, dims);
            out.push(<WallAd key={ad.id} image={ad.image} url={ad.url} title={bi(ad.title, lang, '')} w={w} h={h} position={position} rotation={rotation} />);
          });
        });
        return out;
      })()}

      {/* Big page-turnable PDF presentation on a hall wall (default the far/end wall) */}
      {expo.presentation?.enabled && expo.presentation.pdfUrl && (() => {
        const p = expo.presentation;
        const { position, rotation } = wallTransform(p.wall || 'back', p.u ?? 0.5, p.v ?? 0.55, { width, depth, height });
        return <PresentationScreen url={p.pdfUrl!} w={p.w || Math.min(width * 0.5, 7)} h={p.h || Math.min(height * 0.6, 4)} position={position} rotation={rotation} />;
      })()}

      {/* Booths */}
      {(expo.booths || []).map((b, i) => (
        <Booth key={b.id} booth={b} index={i} lang={lang} onSelectHotspot={onSelectHotspot} onSelectBooth={onSelectBooth} />
      ))}
    </>
  );
};
