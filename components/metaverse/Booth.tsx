import React, { Suspense, useMemo } from 'react';
import { Html, useTexture, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi } from './expoUtils';
import { Hotspot } from './Hotspot';
import { GltfModel } from './GltfModel';

interface Props {
  booth: MetaverseBooth;
  lang: Language;
  onSelectHotspot: (h: MetaverseHotspot) => void;
  onSelectBooth: (b: MetaverseBooth) => void;
}

// Optional image-on-a-plane (logo / banner). Loads lazily; absent → nothing.
const ImagePlane: React.FC<{ url: string; width: number; height: number; position: [number, number, number] }> = ({ url, width, height, position }) => {
  const tex = useTexture(url);
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent toneMapped={false} />
    </mesh>
  );
};

// One exhibition booth — a custom GLB when provided, otherwise a clean procedural stand
// (floor pad, back + side walls, accent banner, name plate, logo, product podium).
export const Booth: React.FC<Props> = ({ booth, lang, onSelectHotspot, onSelectBooth }) => {
  const accent = booth.color || '#2d4a1a';
  const name = bi(booth.name, lang, lang === 'fa' ? 'غرفه' : 'Booth');
  const scale = booth.scale || 1;
  const W = 4, D = 4, wallH = 3;          // procedural booth footprint (meters)
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);

  return (
    <group position={[booth.x || 0, booth.y || 0, booth.z || 0]} rotation={[0, booth.ry || 0, 0]} scale={scale}>
      {booth.modelUrl ? (
        <Suspense fallback={null}>
          <GltfModel url={booth.modelUrl} />
        </Suspense>
      ) : (
        <group>
          {/* Floor pad */}
          <mesh position={[0, 0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W, D]} />
            <meshStandardMaterial color="#f4f5f7" />
          </mesh>
          {/* Accent rim around the pad */}
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[W * 0.62, W * 0.66, 4, 1]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          {/* Back wall */}
          <mesh position={[0, wallH / 2, -D / 2]} castShadow receiveShadow>
            <boxGeometry args={[W, wallH, 0.12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Side walls (half depth, lower) */}
          <mesh position={[-W / 2, wallH / 2.4, -D / 6]} castShadow receiveShadow>
            <boxGeometry args={[0.12, wallH / 1.2, D * 0.66]} />
            <meshStandardMaterial color="#f0f1f4" />
          </mesh>
          <mesh position={[W / 2, wallH / 2.4, -D / 6]} castShadow receiveShadow>
            <boxGeometry args={[0.12, wallH / 1.2, D * 0.66]} />
            <meshStandardMaterial color="#f0f1f4" />
          </mesh>
          {/* Top banner bar in the booth accent color */}
          <RoundedBox args={[W, 0.5, 0.16]} radius={0.06} smoothness={3} position={[0, wallH + 0.05, -D / 2 + 0.06]} castShadow>
            <meshStandardMaterial color={accentColor} />
          </RoundedBox>
          {/* Reception desk / podium */}
          <RoundedBox args={[W * 0.5, 0.95, 0.6]} radius={0.05} smoothness={3} position={[0, 0.48, D / 2 - 0.5]} castShadow receiveShadow>
            <meshStandardMaterial color={accentColor} />
          </RoundedBox>
          <mesh position={[0, 0.98, D / 2 - 0.5]} castShadow>
            <boxGeometry args={[W * 0.52, 0.05, 0.66]} />
            <meshStandardMaterial color="#e8eaed" />
          </mesh>

          {/* Banner image on the back wall, if any */}
          {booth.bannerImage && (
            <Suspense fallback={null}>
              <ImagePlane url={booth.bannerImage} width={W * 0.8} height={wallH * 0.5} position={[0, wallH * 0.55, -D / 2 + 0.07]} />
            </Suspense>
          )}
          {/* Logo above the desk, if any */}
          {booth.logo && (
            <Suspense fallback={null}>
              <ImagePlane url={booth.logo} width={1} height={1} position={[0, 1.7, -D / 2 + 0.08]} />
            </Suspense>
          )}

          {/* Booth name plate (Persian-safe DOM text) — clicking opens the booth's shop */}
          <Html position={[0, wallH + 0.05, -D / 2 + 0.15]} center distanceFactor={11} zIndexRange={[15, 0]}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelectBooth(booth); }}
              style={{ pointerEvents: 'auto', cursor: 'pointer', border: 'none', background: 'transparent', color: '#fff', fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,.55)', fontFamily: 'Vazirmatn, sans-serif' }}
              title={name}
            >
              {name}
            </button>
          </Html>
        </group>
      )}

      {/* Interactive hotspots (positions are local offsets from the booth origin) */}
      {(booth.hotspots || []).map(h => (
        <Hotspot key={h.id} hotspot={h} lang={lang} onSelect={onSelectHotspot} />
      ))}
    </group>
  );
};
